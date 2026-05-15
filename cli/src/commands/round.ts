// cli/src/commands/round.ts
import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import { loadConfig } from '../config.js'
import { today, wrapAction } from './task.js'
import type { TallyDocument, Task, Round, ProgressPoint } from '../types.js'

// ── Helpers ──

function findTaskByEitherPrefix(doc: TallyDocument, id: string): Task | undefined {
  const direct = doc.tasks.find((t) => t.id === id)
  if (direct) return direct
  const prefix = id.startsWith('U-') ? 'D-' : 'U-'
  const otherId = prefix + id.slice(2)
  return doc.tasks.find((t) => t.id === otherId)
}

function isTaskClaimedByOtherActiveRound(doc: TallyDocument, task: Task): boolean {
  if (!task.claimedBy) return false
  return doc.rounds.some((r) => r.id === task.claimedBy && r.status === 'active')
}

function areDepsSatisfied(doc: TallyDocument, task: Task): boolean {
  return task.deps.every((depId) => {
    const dep = findTaskByEitherPrefix(doc, depId)
    return dep !== undefined && dep.status === 'done'
  })
}

export function generateRoundId(doc: TallyDocument): string {
  const prefix = `R-${today()}-`
  const existing = doc.rounds
    .filter((r) => r.id.startsWith(prefix))
    .map((r) => {
      const m = r.id.match(/-(\d{3})$/)
      return m ? parseInt(m[1], 10) : 0
    })
  const max = existing.length > 0 ? Math.max(...existing) : 0
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function getActiveRoundForAgent(doc: TallyDocument, agentId: string): Round | undefined {
  return doc.rounds.find((r) => r.status === 'active' && r.executor === agentId)
}

// ── startRound ──

export interface StartRoundInput {
  cwd?: string
  agentId?: string
  taskIds?: string[]
  strategy?: 'parallel-max' | 'feature-focused' | 'risk-first'
  autoRetry?: boolean
}

export interface StartRoundResult {
  roundId: string
  selected: { taskId: string; goal: string; criteria: string }[]
  warnings: string[]
}

export function startRound(scope: string, input: StartRoundInput = {}): StartRoundResult {
  const cwd = input.cwd ?? process.cwd()
  const config = loadConfig(cwd)
  const agentId = input.agentId ?? config.agent.id
  const doc = readLedger(cwd)

  // Check if agent already has an active round (unless parallel rounds are allowed)
  const existingActive = getActiveRoundForAgent(doc, agentId)
  if (existingActive && !config.round.allowParallel) {
    throw new Error(
      `Agent "${agentId}" already has an active round (${existingActive.id}). ` +
        `Complete it first with 'tally round close'. ` +
        `Set round.allowParallel=true in config to allow parallel rounds.`,
    )
  }

  let candidateIds: string[]

  if (input.taskIds && input.taskIds.length > 0) {
    candidateIds = input.taskIds
  } else {
    // Auto-select: pending/in_progress tasks with satisfied deps.
    // Sort based on strategy: feature-focused groups by feature, risk-first by risk, parallel-max by depth.
    const strategy = input.strategy ?? 'parallel-max'
    const eligible = doc.tasks
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .filter((t) => !isTaskClaimedByOtherActiveRound(doc, t))
      .filter((t) => areDepsSatisfied(doc, t))

    // Compute topological depth for each task (longest path from any root)
    const depthMap = new Map<string, number>()
    const computeDepth = (taskId: string, visited: Set<string>): number => {
      if (depthMap.has(taskId)) return depthMap.get(taskId)!
      if (visited.has(taskId)) return 0 // cycle guard
      visited.add(taskId)
      const task = findTaskByEitherPrefix(doc, taskId)
      if (!task || task.deps.length === 0) {
        depthMap.set(taskId, 0)
        return 0
      }
      let maxDep = 0
      for (const depId of task.deps) {
        maxDep = Math.max(maxDep, computeDepth(depId, new Set(visited)) + 1)
      }
      depthMap.set(taskId, maxDep)
      return maxDep
    }
    for (const t of eligible) computeDepth(t.id, new Set())

    // Sort based on strategy
    const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 }
    if (strategy === 'feature-focused') {
      // Group all eligible tasks by feature, pick tasks from one feature at a time
      eligible.sort((a, b) => {
        if ((a.feature ?? '') !== (b.feature ?? '')) return (a.feature ?? '').localeCompare(b.feature ?? '')
        if (a.module !== b.module) return a.module.localeCompare(b.module)
        return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      })
    } else if (strategy === 'risk-first') {
      // Highest risk tasks first
      eligible.sort((a, b) => {
        const ra = riskOrder[a.riskLevel] ?? 1
        const rb = riskOrder[b.riskLevel] ?? 1
        if (ra !== rb) return rb - ra  // critical first
        if (a.module !== b.module) return a.module.localeCompare(b.module)
        return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      })
    } else {
      // parallel-max: shallow depth first, group by module then feature
      eligible.sort((a, b) => {
        const depthA = depthMap.get(a.id) ?? 0
        const depthB = depthMap.get(b.id) ?? 0
        if (depthA !== depthB) return depthA - depthB
        if (a.module !== b.module) return a.module.localeCompare(b.module)
        if ((a.feature ?? '') !== (b.feature ?? '')) return (a.feature ?? '').localeCompare(b.feature ?? '')
        return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      })
    }

    candidateIds = eligible.slice(0, config.round.maxTasks).map((t) => t.id)

    if (candidateIds.length === 0) {
      throw new Error(
        'No eligible tasks found. All pending/in-progress tasks either have unsatisfied dependencies or are claimed by active rounds.',
      )
    }
  }

  // Validate all candidates before claiming any (atomic)
  // If autoRetry is enabled, exclude conflicting tasks and retry
  const MAX_RETRIES = 10
  const autoRetry = input.autoRetry ?? false
  const autoExcluded: string[] = []
  let selected: { taskId: string; goal: string; criteria: string }[] = []
  let errors: string[] = []

  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    const remainingIds = autoRetry && retry > 0
      ? candidateIds.filter((id) => !autoExcluded.includes(id))
      : candidateIds

    if (remainingIds.length === 0) {
      if (autoRetry) {
        throw new Error(
          'No eligible tasks after auto-retry. Excluded tasks:\n' +
            autoExcluded.map((id) => `  - ${id}`).join('\n'),
        )
      }
      throw new Error(
        'No eligible tasks found. All pending/in-progress tasks either have unsatisfied dependencies or are claimed by active rounds.',
      )
    }

    errors = []
    selected = []

    for (const id of remainingIds) {
      const task = findTaskByEitherPrefix(doc, id)
      if (!task) {
        errors.push(`Task "${id}" not found`)
        continue
      }

      if (task.status !== 'pending' && task.status !== 'in_progress') {
        errors.push(`Task "${task.id}" has status "${task.status}" — cannot be claimed`)
        continue
      }

      if (isTaskClaimedByOtherActiveRound(doc, task)) {
        errors.push(`Task "${task.id}" is already claimed by active round "${task.claimedBy}"`)
        continue
      }

      if (!areDepsSatisfied(doc, task)) {
        const unsatisfied = task.deps.filter((depId) => {
          const dep = findTaskByEitherPrefix(doc, depId)
          return !dep || dep.status !== 'done'
        })
        errors.push(`Task "${task.id}" has unsatisfied dependencies: ${unsatisfied.join(', ')}`)
        continue
      }

      // Write scope conflict
      if (config.gates.detectWriteConflicts && task.writeScopes.length > 0) {
        for (const s of selected) {
          const other = findTaskByEitherPrefix(doc, s.taskId)
          if (other && other.writeScopes.length > 0) {
            const overlap = task.writeScopes.filter((ws) => other.writeScopes.includes(ws))
            if (overlap.length > 0) {
              errors.push(
                `Task "${task.id}" write scope conflicts with "${other.id}": ${overlap.join(', ')}`,
              )
              break
            }
          }
        }
        if (errors.length > 0 && errors[errors.length - 1].includes('write scope')) continue
      }

      // Risk gating
      const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 }
      if (riskOrder[task.riskLevel] > riskOrder[config.gates.maxRisk]) {
        errors.push(
          `Task "${task.id}" has risk level "${task.riskLevel}" exceeding max "${config.gates.maxRisk}"`,
        )
        continue
      }

      // Feature freeze
      if (task.feature && config.gates.featureFreeze.length > 0) {
        const feat = doc._meta.features.find((f) => f.id === task.feature)
        if (feat) {
          const isFrozen = config.gates.featureFreeze.includes(task.feature)
          const isFrozenInMeta = feat.status === 'contract_frozen' || feat.status === 'stable'
          if ((isFrozen || isFrozenInMeta) && task.executionLane !== 'contract' && task.executionLane !== 'test') {
            errors.push(
              `Task "${task.id}" belongs to frozen feature "${task.feature}" — only contract/test tasks allowed`,
            )
            continue
          }
        }
      }

      // Approval gate
      if ((task.riskLevel === 'high' || task.riskLevel === 'critical') && !task.approvedBy) {
        errors.push(
          `Task "${task.id}" is ${task.riskLevel} risk but not approved — use "tally task approve ${task.id} --by <name>"`,
        )
        continue
      }

      selected.push({
        taskId: task.id,
        goal: task.name,
        criteria: task.acceptance,
      })
    }

    // If no errors, we're done
    if (errors.length === 0) break

    // If not auto-retrying, fail atomically
    if (!autoRetry) {
      throw new Error(
        'Cannot start round — the following tasks have conflicts:\n' +
          errors.map((e) => `  - ${e}`).join('\n'),
      )
    }

    // Auto-retry: extract failed task IDs, exclude them, and retry
    const failedIds = new Set<string>()
    for (const err of errors) {
      const match = err.match(/^Task "([^"]+)"/)
      if (match) failedIds.add(match[1])
    }
    for (const fid of failedIds) {
      if (!autoExcluded.includes(fid)) {
        autoExcluded.push(fid)
      }
    }
  }

  // Collect warnings (non-blocking issues)
  const warnings: string[] = []

  // Report auto-excluded tasks
  if (autoRetry && autoExcluded.length > 0) {
    warnings.push(`Auto-excluded ${autoExcluded.length} task(s): ${autoExcluded.join(', ')}`)
  }

  // Generate round ID
  const roundId = generateRoundId(doc)

  // Claim all selected tasks
  for (const s of selected) {
    const task = findTaskByEitherPrefix(doc, s.taskId)!
    task.claimedBy = roundId
    task.claimedAt = today()
  }

  // Create round entry
  const round: Round = {
    id: roundId,
    start: today(),
    executor: agentId,
    scope,
    exclusions: '',
    plannedTasks: selected,
    completedAt: null,
    status: 'active',
  }

  doc.rounds.push(round)
  writeLedger(doc, cwd)

  // Add lane distribution warning
  const lanes = new Map<string, number>()
  for (const s of selected) {
    const t = findTaskByEitherPrefix(doc, s.taskId)
    if (t?.executionLane) lanes.set(t.executionLane, (lanes.get(t.executionLane) ?? 0) + 1)
  }
  if (lanes.size > 0) {
    warnings.push(`Lane distribution: ${[...lanes.entries()].map(([l, c]) => `${l}=${c}`).join(', ')}`)
  }

  return { roundId, selected, warnings }
}

// ── generateRoundReport ──

export interface RoundReportResult {
  roundId: string
  tasks: {
    taskId: string
    goal: string
    criteria: string
    status: string
    completedAt: string | null
  }[]
  doneCount: number
  totalCount: number
  remaining: string[]
}

export function generateRoundReport(
  doc: TallyDocument,
  roundId?: string,
  agentId?: string,
): RoundReportResult {
  let round: Round | undefined

  if (roundId) {
    round = doc.rounds.find((r) => r.id === roundId)
    if (!round) {
      throw new Error(`Round "${roundId}" not found.`)
    }
  } else if (agentId) {
    // Latest active round for configured agent, then fall back to latest round overall
    round = getActiveRoundForAgent(doc, agentId)
    if (!round && doc.rounds.length > 0) {
      round = doc.rounds[doc.rounds.length - 1]
    }
  } else if (doc.rounds.length > 0) {
    round = doc.rounds[doc.rounds.length - 1]
  }

  if (!round) {
    throw new Error('No round found.')
  }

  const tasks = round.plannedTasks.map((pt) => {
    const task = findTaskByEitherPrefix(doc, pt.taskId)
    return {
      taskId: pt.taskId,
      goal: pt.goal,
      criteria: pt.criteria,
      status: task?.status ?? 'unknown',
      completedAt: task?.completedAt ?? null,
    }
  })

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const remaining = tasks.filter((t) => t.status !== 'done').map((t) => t.taskId)

  return {
    roundId: round.id,
    tasks,
    doneCount,
    totalCount: tasks.length,
    remaining,
  }
}

// ── closeRound ──

export interface CloseRoundInput {
  cwd?: string
  agentId?: string
  roundId?: string
  autoNext?: boolean
  nextStrategy?: StartRoundInput['strategy']
  nextAutoRetry?: boolean
}

export interface CloseRoundResult {
  roundId: string
  done: number
  reverted: number
  nextRound?: StartRoundResult
}

export function closeRound(input: CloseRoundInput = {}): CloseRoundResult {
  const cwd = input.cwd ?? process.cwd()
  const config = loadConfig(cwd)
  const agentId = input.agentId ?? config.agent.id
  const doc = readLedger(cwd)

  let round: Round | undefined

  if (input.roundId) {
    round = doc.rounds.find((r) => r.id === input.roundId)
  } else {
    // Find agent's active round, then fall back to latest active round
    round = getActiveRoundForAgent(doc, agentId)
    if (!round) {
      const activeRounds = doc.rounds.filter((r) => r.status === 'active')
      if (activeRounds.length > 0) {
        round = activeRounds[activeRounds.length - 1]
      }
    }
  }

  if (!round) {
    throw new Error('No active round found.')
  }

  if (round.status !== 'active') {
    throw new Error(`Round "${round.id}" is already ${round.status}.`)
  }

  let done = 0
  let reverted = 0

  for (const pt of round.plannedTasks) {
    const task = findTaskByEitherPrefix(doc, pt.taskId)
    if (!task) continue

    // Release claim regardless of status
    task.claimedBy = null
    task.claimedAt = null

    if (task.status === 'done') {
      done++
    } else {
      // Revert non-done tasks back to pending
      task.status = 'pending'
      if (task.blocks) task.blocks = null
      reverted++
    }
  }

  // Close the round
  round.status = 'completed'
  round.completedAt = today()

  // Compute progress snapshot
  const totalDone = doc.tasks.filter((t) => t.status === 'done').length
  const totalOpen = doc.tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  ).length
  const totalHold = doc.tasks.filter(
    (t) => t.status === 'hold' || t.status === 'deferred',
  ).length
  const totalBlocked = doc.tasks.filter((t) => t.status === 'blocked').length

  const progress: ProgressPoint = {
    date: today(),
    totalDone,
    totalOpen,
    totalHold,
    totalBlocked,
    evidence: `Round ${round.id} closed: ${done} done, ${reverted} reverted to pending`,
    notes: round.scope,
  }

  doc.progress.push(progress)
  writeLedger(doc, cwd)

  const result: CloseRoundResult = { roundId: round.id, done, reverted }

  // Auto-next: close and immediately start a new round
  if (input.autoNext) {
    const nextResult = startRound(round.scope, {
      cwd,
      agentId,
      strategy: input.nextStrategy ?? 'parallel-max',
      autoRetry: input.nextAutoRetry ?? true,
    })
    result.nextRound = nextResult
  }

  return result
}

// ── Formatting ──

export function formatRoundStart(result: StartRoundResult): string {
  const lines: string[] = []
  lines.push(`Round started: ${result.roundId}`)
  lines.push(`Tasks claimed: ${result.selected.length}`)
  if (result.warnings.length > 0) {
    lines.push(`Warnings:`)
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w}`)
    }
  }
  lines.push('')
  for (const s of result.selected) {
    lines.push(`  ${s.taskId}  ${s.goal}`)
  }
  return lines.join('\n')
}

function formatRoundReport(report: RoundReportResult): string {
  const lines: string[] = []
  lines.push(`Round: ${report.roundId}`)
  lines.push(`Progress: ${report.doneCount} / ${report.totalCount} done`)
  lines.push('')

  for (const t of report.tasks) {
    const icon = t.status === 'done' ? '✓' : '○'
    lines.push(`  ${icon} ${t.taskId} [${t.status}] ${t.goal}`)
  }

  if (report.remaining.length > 0) {
    lines.push('')
    lines.push(`Remaining: ${report.remaining.join(', ')}`)
  }

  return lines.join('\n')
}

function formatRoundClose(result: CloseRoundResult): string {
  const lines: string[] = []
  lines.push(`Round closed: ${result.roundId}`)
  lines.push(`  Done: ${result.done}`)
  lines.push(`  Reverted to pending: ${result.reverted}`)
  return lines.join('\n')
}

// ── Commander command ──

export function roundCommand(): Command {
  const cmd = new Command('round')
  cmd.description('Round lifecycle management')

  // tally round start <scope>
  cmd
    .command('start')
    .description('Start a new execution round')
    .argument('<scope>', 'Round scope description')
    .option('--tasks <ids...>', 'Specific task IDs to claim')
    .option('--agent <id>', 'Executor agent ID')
    .option('--strategy <strategy>', 'Round strategy: parallel-max, feature-focused, or risk-first')
    .option('--auto-retry', 'Auto-exclude conflicting tasks and retry')
    .option('--json', 'Output errors as machine-parseable JSON')
    .action((scope: string, opts: { tasks?: string[]; agent?: string; strategy?: string; autoRetry?: boolean; json?: boolean }) => {
      wrapAction(opts, () => {
        const result = startRound(scope, {
          agentId: opts.agent,
          taskIds: opts.tasks,
          strategy: opts.strategy as StartRoundInput['strategy'],
          autoRetry: opts.autoRetry,
        })
        if (opts.json) {
          console.log(JSON.stringify({ ok: true, ...result }))
        } else {
          console.log(formatRoundStart(result))
        }
      })
    })

  // tally round report
  cmd
    .command('report')
    .description('Show round progress report')
    .option('--round <id>', 'Round ID to report on')
    .option('--json', 'Output as JSON')
    .action((opts: { round?: string; json?: boolean }) => {
      try {
        const config = loadConfig()
        const doc = readLedger()
        const report = generateRoundReport(doc, opts.round, config.agent.id)

        if (opts.json) {
          console.log(JSON.stringify(report, null, 2))
        } else {
          console.log(formatRoundReport(report))
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally round close
  cmd
    .command('close')
    .description('Close an active round, release claims, record progress')
    .option('--round <id>', 'Round ID to close')
    .option('--auto-next', 'Auto-start a new round after closing')
    .option('--strategy <strategy>', 'Strategy for the next round (with --auto-next)')
    .option('--auto-retry', 'Auto-exclude conflicting tasks in next round (with --auto-next)')
    .option('--json', 'Output errors as JSON')
    .action((opts: { round?: string; autoNext?: boolean; strategy?: string; autoRetry?: boolean; json?: boolean }) => {
      wrapAction(opts, () => {
        const result = closeRound({
          roundId: opts.round,
          autoNext: opts.autoNext,
          nextStrategy: opts.strategy as StartRoundInput['strategy'],
          nextAutoRetry: opts.autoRetry,
        })
        if (opts.json) {
          console.log(JSON.stringify({ ok: true, ...result }))
        } else {
          console.log(formatRoundClose(result))
          if (result.nextRound) {
            console.log('')
            console.log(formatRoundStart(result.nextRound))
          }
        }
      })
    })

  return cmd
}
