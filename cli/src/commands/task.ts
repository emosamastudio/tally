// cli/src/commands/task.ts
import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import type { Task, TallyDocument } from '../types.js'

// ── Helpers ──

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nextTaskId(doc: TallyDocument, prefix: 'U' | 'D' = 'U'): string {
  const ids = doc.tasks.map((t) => {
    const m = t.id.match(/^[UD]-(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  })
  const max = ids.length > 0 ? Math.max(...ids) : 0
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

export function nextOrder(doc: TallyDocument): number {
  const orders = doc.tasks
    .filter((t) => t.status !== 'done' && t.order !== null)
    .map((t) => t.order as number)
  return orders.length > 0 ? Math.max(...orders) + 1 : 1
}

export function nextCompletedOrder(doc: TallyDocument): number {
  const orders = doc.tasks
    .filter((t) => t.status === 'done' && t.completedOrder !== null)
    .map((t) => t.completedOrder as number)
  return orders.length > 0 ? Math.max(...orders) + 1 : 1
}

function validateMetaRefs(doc: TallyDocument, stage: string, module: string): void {
  if (!doc._meta.stages.some((s) => s.id === stage)) {
    throw new Error(`Stage "${stage}" not found in _meta.stages`)
  }
  if (!doc._meta.modules.some((m) => m.id === module)) {
    throw new Error(`Module "${module}" not found in _meta.modules`)
  }
}

// ── Task manipulation functions (exported for testing) ──

export interface AddTaskInput {
  name: string
  priority?: string
  stage: string
  module: string
  acceptance?: string
  deps?: string[]
  tags?: string[]
  feature?: string
  writeScopes?: string[]
  acceptanceCriteria?: Record<string, unknown>
  executionPlan?: Record<string, unknown>
  riskLevel?: string
  rollbackPlan?: string
  executionLane?: string
  assignedAgent?: string
  requiresReview?: boolean
  resourceRequirements?: string[]
  repos?: string[]
  deliveryNode?: string
}

export function addTasks(doc: TallyDocument, inputs: AddTaskInput[]): Task[] {
  const created: Task[] = []

  for (const input of inputs) {
    validateMetaRefs(doc, input.stage, input.module)

    const task: Task = {
      id: nextTaskId(doc, 'U'),
      status: 'pending',
      priority: (input.priority as Task['priority']) ?? 'P1',
      stage: input.stage,
      module: input.module,
      name: input.name,
      acceptance: input.acceptance ?? '待定义',
      deps: input.deps ?? [],
      blocks: null,
      nextAction: null,
      evidence: null,
      rule: null,
      feature: input.feature ?? null,
      tags: input.tags ?? [],
      order: nextOrder(doc),
      completedOrder: null,
      claimedBy: null,
      claimedAt: null,
      createdAt: today(),
      completedAt: null,
      writeScopes: input.writeScopes ?? [],
      acceptanceCriteria: (input.acceptanceCriteria as Task['acceptanceCriteria']) ?? null,
      executionPlan: (input.executionPlan as Task['executionPlan']) ?? null,
      riskLevel: (input.riskLevel as Task['riskLevel']) ?? 'medium',
      rollbackPlan: input.rollbackPlan ?? null,
      executionLane: (input.executionLane as Task['executionLane']) ?? null,
      assignedAgent: input.assignedAgent ?? null,
      requiresReview: input.requiresReview ?? false,
      resourceRequirements: input.resourceRequirements ?? [],
      repos: input.repos ?? [],
      deliveryNode: input.deliveryNode ?? null,
      approvedBy: null,
    }

    doc.tasks.push(task)
    created.push(task)
  }

  return created
}

export interface TaskDetail {
  task: Task
  ancestors: Task[]
  descendants: Task[]
}

export function getTaskDetail(doc: TallyDocument, id: string): TaskDetail {
  const task = doc.tasks.find((t) => t.id === id)
  if (!task) {
    throw new Error(`Task "${id}" not found`)
  }

  const ancestors = collectAncestors(doc, id)
  const descendants = collectDescendants(doc, id)

  return { task, ancestors, descendants }
}

function collectAncestors(doc: TallyDocument, id: string, visited: Set<string> = new Set()): Task[] {
  if (visited.has(id)) return []
  visited.add(id)

  const task = doc.tasks.find((t) => t.id === id)
  if (!task || task.deps.length === 0) return []

  const result: Task[] = []
  for (const depId of task.deps) {
    const depTask = doc.tasks.find((t) => t.id === depId)
    if (depTask) {
      result.push(depTask)
      result.push(...collectAncestors(doc, depId, visited))
    }
  }
  return result
}

function collectDescendants(doc: TallyDocument, id: string, visited: Set<string> = new Set()): Task[] {
  if (visited.has(id)) return []
  visited.add(id)

  const result: Task[] = []
  for (const task of doc.tasks) {
    if (task.deps.includes(id) && !visited.has(task.id)) {
      result.push(task)
      result.push(...collectDescendants(doc, task.id, visited))
    }
  }
  return result
}

export function editTask(doc: TallyDocument, id: string, fields: Record<string, unknown>): Task {
  const task = doc.tasks.find((t) => t.id === id)
  if (!task) {
    throw new Error(`Task "${id}" not found`)
  }
  if (task.status === 'done') {
    throw new Error(`Task "${id}" is already done. Use "tally task done" for status changes.`)
  }

  if (fields.name !== undefined) task.name = fields.name as string
  if (fields.priority !== undefined) {
    const p = fields.priority as string
    if (!['P0', 'P1', 'P2'].includes(p)) {
      throw new Error(`Invalid priority "${p}". Must be P0, P1, or P2.`)
    }
    task.priority = p as Task['priority']
  }
  if (fields.stage !== undefined) {
    const stage = fields.stage as string
    if (!doc._meta.stages.some((s) => s.id === stage)) {
      throw new Error(`Stage "${stage}" not found in _meta.stages`)
    }
    task.stage = stage
  }
  if (fields.module !== undefined) {
    const mod = fields.module as string
    if (!doc._meta.modules.some((m) => m.id === mod)) {
      throw new Error(`Module "${mod}" not found in _meta.modules`)
    }
    task.module = mod
  }
  if (fields.acceptance !== undefined) task.acceptance = fields.acceptance as string
  if (fields.deps !== undefined) task.deps = fields.deps as string[]
  if (fields.nextAction !== undefined) task.nextAction = fields.nextAction as string | null
  if (fields.tags !== undefined) task.tags = fields.tags as string[]
  if (fields.feature !== undefined) task.feature = fields.feature as string | null
  if (fields.writeScopes !== undefined) task.writeScopes = fields.writeScopes as string[]
  if (fields.acceptanceCriteria !== undefined) task.acceptanceCriteria = fields.acceptanceCriteria as Task['acceptanceCriteria']
  if (fields.executionPlan !== undefined) task.executionPlan = fields.executionPlan as Task['executionPlan']
  if (fields.riskLevel !== undefined) {
    const rl = fields.riskLevel as string
    if (!['low', 'medium', 'high', 'critical'].includes(rl)) {
      throw new Error(`Invalid riskLevel "${rl}". Must be low, medium, high, or critical.`)
    }
    task.riskLevel = rl as Task['riskLevel']
  }
  if (fields.rollbackPlan !== undefined) task.rollbackPlan = fields.rollbackPlan as string | null
  if (fields.executionLane !== undefined) {
    const lane = fields.executionLane as string
    if (!['contract', 'writer', 'runtime', 'ui', 'test', 'review'].includes(lane)) {
      throw new Error(`Invalid executionLane "${lane}". Must be contract, writer, runtime, ui, test, or review.`)
    }
    task.executionLane = lane as Task['executionLane']
  }
  if (fields.assignedAgent !== undefined) task.assignedAgent = fields.assignedAgent as string | null
  if (fields.requiresReview !== undefined) task.requiresReview = !!fields.requiresReview
  if (fields.resourceRequirements !== undefined) task.resourceRequirements = fields.resourceRequirements as string[]
  if (fields.repos !== undefined) task.repos = fields.repos as string[]
  if (fields.deliveryNode !== undefined) task.deliveryNode = fields.deliveryNode as string | null

  return task
}

export function markTasksDone(
  doc: TallyDocument,
  ids: string[],
  evidence: string,
  rule?: string,
): Task[] {
  const results: Task[] = []

  for (const id of ids) {
    const task = doc.tasks.find((t) => t.id === id)
    if (!task) {
      throw new Error(`Task "${id}" not found`)
    }
    if (task.status === 'done') {
      throw new Error(`Task "${id}" is already done`)
    }

    // Update task fields
    task.status = 'done'
    task.evidence = evidence
    if (rule !== undefined) task.rule = rule
    task.completedAt = today()
    task.completedOrder = nextCompletedOrder(doc)
    task.order = null
    task.nextAction = null
    task.blocks = null

    // Rewrite U-xxx → D-xxx (or update existing D- prefix)
    const oldId = task.id
    const numPart = oldId.match(/^[UD]-(\d+)$/)?.[1]
    const newId = numPart ? `D-${String(parseInt(numPart, 10)).padStart(3, '0')}` : oldId
    task.id = newId

    // Update references in other tasks' deps arrays
    for (const other of doc.tasks) {
      if (other.deps.includes(oldId)) {
        other.deps = other.deps.map((d) => (d === oldId ? newId : d))
      }
    }

    // Update references in rounds' plannedTasks
    for (const round of doc.rounds) {
      for (const pt of round.plannedTasks) {
        if (pt.taskId === oldId) {
          pt.taskId = newId
        }
      }
    }

    // Update references in blocks' affects
    for (const block of doc.blocks) {
      if (block.affects.includes(oldId)) {
        block.affects = block.affects.map((a) => (a === oldId ? newId : a))
      }
    }

    results.push(task)
  }

  return results
}

export function blockTasks(doc: TallyDocument, ids: string[], reason: string): Task[] {
  const results: Task[] = []

  for (const id of ids) {
    const task = doc.tasks.find((t) => t.id === id)
    if (!task) {
      throw new Error(`Task "${id}" not found`)
    }
    if (task.status === 'done') {
      throw new Error(`Task "${id}" is already done. Cannot block a done task.`)
    }

    task.status = 'blocked'
    task.blocks = reason
    results.push(task)
  }

  return results
}

export function unblockTasks(doc: TallyDocument, ids: string[]): Task[] {
  const results: Task[] = []

  for (const id of ids) {
    const task = doc.tasks.find((t) => t.id === id)
    if (!task) {
      throw new Error(`Task "${id}" not found`)
    }
    if (task.status !== 'blocked') {
      throw new Error(`Task "${id}" is not blocked (status: ${task.status})`)
    }

    task.status = 'pending'
    task.blocks = null
    results.push(task)
  }

  return results
}

export interface ListFilters {
  status?: string
  module?: string
  stage?: string
  priority?: string
  tag?: string
  feature?: string
  search?: string
}

export function listTasks(doc: TallyDocument, filters: ListFilters): Task[] {
  let tasks = [...doc.tasks]

  if (filters.status) {
    tasks = tasks.filter((t) => t.status === filters.status)
  }
  if (filters.module) {
    tasks = tasks.filter((t) => t.module === filters.module)
  }
  if (filters.stage) {
    tasks = tasks.filter((t) => t.stage === filters.stage)
  }
  if (filters.priority) {
    tasks = tasks.filter((t) => t.priority === filters.priority)
  }
  if (filters.tag) {
    tasks = tasks.filter((t) => t.tags.includes(filters.tag!))
  }
  if (filters.feature) {
    tasks = tasks.filter((t) => t.feature === filters.feature)
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    tasks = tasks.filter((t) => t.name.toLowerCase().includes(s) || t.id.toLowerCase().includes(s))
  }

  return tasks
}

// ── Formatting ──

export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) return '(no tasks)'

  const lines: string[] = []
  // id, name, stage, status, priority
  lines.push('ID      NAME                          STAGE  STATUS        PRIORITY')
  lines.push('------  ----------------------------  -----  ------------  --------')

  for (const t of tasks) {
    const id = t.id.padEnd(6)
    const name = t.name.length > 28 ? t.name.slice(0, 27) + '…' : t.name.padEnd(28)
    const stage = t.stage.padEnd(5)
    const status = t.status.padEnd(12)
    const priority = t.priority
    lines.push(`${id}  ${name}  ${stage}  ${status}  ${priority}`)
  }

  return lines.join('\n')
}

export function formatTaskDetail(detail: TaskDetail): string {
  const t = detail.task
  const lines: string[] = []

  lines.push(`ID:          ${t.id}`)
  lines.push(`Name:        ${t.name}`)
  lines.push(`Status:      ${t.status}`)
  lines.push(`Priority:    ${t.priority}`)
  lines.push(`Stage:       ${t.stage}`)
  lines.push(`Module:      ${t.module}`)
  lines.push(`Acceptance:  ${t.acceptance}`)
  lines.push(`Deps:        ${t.deps.length > 0 ? t.deps.join(', ') : '(none)'}`)
  lines.push(`Blocks:      ${t.blocks ?? '(none)'}`)
  lines.push(`Next Action: ${t.nextAction ?? '(none)'}`)
  lines.push(`Evidence:    ${t.evidence ?? '(none)'}`)
  lines.push(`Rule:        ${t.rule ?? '(none)'}`)
  lines.push(`Feature:     ${t.feature ?? '(none)'}`)
  lines.push(`Risk:        ${t.riskLevel}`)
  lines.push(`Lane:        ${t.executionLane ?? '(none)'}`)
  lines.push(`Write Scopes: ${t.writeScopes.length > 0 ? t.writeScopes.join(', ') : '(none)'}`)
  lines.push(`Repos:       ${t.repos.length > 0 ? t.repos.join(', ') : '(none)'}`)
  lines.push(`Delivery:    ${t.deliveryNode ?? '(none)'}`)
  lines.push(`Review:      ${t.requiresReview ? 'Yes' : 'No'}`)
  lines.push(`Assigned:    ${t.assignedAgent ?? '(none)'}`)
  lines.push(`Approved:    ${t.approvedBy ?? '(none)'}`)
  if (t.executionPlan) {
    lines.push(`Exec Plan:   inputs=[${(t.executionPlan.inputs ?? []).join(', ')}] outputs=[${(t.executionPlan.outputs ?? []).join(', ')}] steps=[${(t.executionPlan.steps ?? []).join('; ')}]`)
  }
  if (t.acceptanceCriteria) {
    const ac = t.acceptanceCriteria
    if (ac.requiredTests?.length) lines.push(`Tests:       ${ac.requiredTests.join(', ')}`)
    if (ac.passConditions?.length) lines.push(`Pass:        ${ac.passConditions.join('; ')}`)
    if (ac.forbiddenSideEffects?.length) lines.push(`Forbidden:   ${ac.forbiddenSideEffects.join('; ')}`)
    if (ac.negativeCases?.length) lines.push(`Negatives:   ${ac.negativeCases.join('; ')}`)
  }
  if (t.rollbackPlan) lines.push(`Rollback:    ${t.rollbackPlan}`)
  lines.push(`Resources:   ${t.resourceRequirements.length > 0 ? t.resourceRequirements.join(', ') : '(none)'}`)
  lines.push(`Tags:        ${t.tags.length > 0 ? t.tags.join(', ') : '(none)'}`)
  lines.push(`Order:       ${t.order ?? '(none)'}`)
  lines.push(`Comp.Order:  ${t.completedOrder ?? '(none)'}`)
  lines.push(`Claimed By:  ${t.claimedBy ?? '(none)'}`)
  lines.push(`Claimed At:  ${t.claimedAt ?? '(none)'}`)
  lines.push(`Created:     ${t.createdAt}`)
  lines.push(`Completed:   ${t.completedAt ?? '(none)'}`)

  if (detail.ancestors.length > 0) {
    lines.push('')
    lines.push('Ancestors (depends on):')
    for (const a of detail.ancestors) {
      lines.push(`  ${a.id} [${a.status}] ${a.name}`)
    }
  }

  if (detail.descendants.length > 0) {
    lines.push('')
    lines.push('Descendants (depends on this):')
    for (const d of detail.descendants) {
      lines.push(`  ${d.id} [${d.status}] ${d.name}`)
    }
  }

  return lines.join('\n')
}

// ── Commander command ──

export function taskCommand(): Command {
  const cmd = new Command('task')
  cmd.description('Task CRUD operations')

  // tally task add --json '[...]'
  cmd.command('add')
    .description('Batch create tasks from a JSON array')
    .requiredOption('--json <json>', 'JSON array of task objects')
    .action((opts: { json: string }) => {
      try {
        let inputs: AddTaskInput[]
        try {
          inputs = JSON.parse(opts.json) as AddTaskInput[]
        } catch {
          throw new Error('Invalid JSON for --json flag')
        }

        if (!Array.isArray(inputs)) {
          throw new Error('--json must be a JSON array of task objects')
        }
        if (inputs.length === 0) {
          throw new Error('--json array is empty')
        }

        const doc = readLedger()
        const created = addTasks(doc, inputs)
        writeLedger(doc)

        console.log(`Created ${created.length} task(s):`)
        for (const t of created) {
          console.log(`  ${t.id}  ${t.name}`)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task show <id>
  cmd.command('show')
    .description('Print full task detail + dependency tree')
    .argument('<id>', 'Task ID (e.g. U-001)')
    .action((id: string) => {
      try {
        const doc = readLedger()
        const detail = getTaskDetail(doc, id)
        console.log(formatTaskDetail(detail))
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task edit <id> --field value
  cmd.command('edit')
    .description('Modify a single field on a task')
    .argument('<id>', 'Task ID (e.g. U-001)')
    .option('--name <name>', 'Task name')
    .option('--priority <priority>', 'Priority: P0, P1, or P2')
    .option('--stage <stage>', 'Stage ID')
    .option('--module <module>', 'Module ID')
    .option('--acceptance <acceptance>', 'Acceptance criteria')
    .option('--deps <deps>', 'Comma-separated dependency IDs')
    .option('--next-action <action>', 'Next action text')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--feature <feature>', 'Feature name')
    .option('--risk-level <level>', 'Risk: low, medium, high, critical')
    .option('--execution-lane <lane>', 'Lane: contract, writer, runtime, ui, test, review')
    .option('--write-scopes <scopes>', 'Comma-separated write scope paths')
    .option('--assigned-agent <agent>', 'Assigned agent ID')
    .option('--requires-review', 'Task requires code review')
    .option('--rollback-plan <plan>', 'Rollback plan for high-risk tasks')
    .option('--repos <repos>', 'Comma-separated repo names')
    .option('--delivery-node <node>', 'Delivery milestone node')
    .option('--resource-requirements <resources>', 'Comma-separated resource requirements')
    .action((id: string, opts: Record<string, string | boolean | undefined>) => {
      try {
        const doc = readLedger()
        const fields: Record<string, unknown> = {}

        if (opts.name !== undefined) fields.name = opts.name
        if (opts.priority !== undefined) fields.priority = opts.priority
        if (opts.stage !== undefined) fields.stage = opts.stage
        if (opts.module !== undefined) fields.module = opts.module
        if (opts.acceptance !== undefined) fields.acceptance = opts.acceptance
        if (opts.deps !== undefined) {
          fields.deps = (opts.deps as string).split(',').map((d: string) => d.trim()).filter(Boolean)
        }
        if (opts.nextAction !== undefined) {
          fields.nextAction = opts.nextAction === '' ? null : opts.nextAction
        }
        if (opts.tags !== undefined) {
          fields.tags = (opts.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
        }
        if (opts.feature !== undefined) {
          fields.feature = opts.feature === '' ? null : opts.feature
        }
        if (opts.riskLevel !== undefined) fields.riskLevel = opts.riskLevel
        if (opts.executionLane !== undefined) fields.executionLane = opts.executionLane
        if (opts.writeScopes !== undefined) {
          fields.writeScopes = (opts.writeScopes as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        }
        if (opts.assignedAgent !== undefined) {
          fields.assignedAgent = opts.assignedAgent === '' ? null : opts.assignedAgent
        }
        if (opts.requiresReview !== undefined) fields.requiresReview = true
        if (opts.rollbackPlan !== undefined) {
          fields.rollbackPlan = opts.rollbackPlan === '' ? null : opts.rollbackPlan
        }
        if (opts.repos !== undefined) {
          fields.repos = (opts.repos as string).split(',').map((r: string) => r.trim()).filter(Boolean)
        }
        if (opts.deliveryNode !== undefined) {
          fields.deliveryNode = opts.deliveryNode === '' ? null : opts.deliveryNode
        }
        if (opts.resourceRequirements !== undefined) {
          fields.resourceRequirements = (opts.resourceRequirements as string).split(',').map((r: string) => r.trim()).filter(Boolean)
        }

        if (Object.keys(fields).length === 0) {
          throw new Error('No fields specified. Use --name, --priority, --stage, --module, --acceptance, --deps, --next-action, --tags, --feature, --risk-level, --execution-lane, --write-scopes, etc.')
        }

        const task = editTask(doc, id, fields)
        writeLedger(doc)
        console.log(`Updated ${task.id}: ${task.name}`)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task done <id...> --evidence "..." [--rule "..."] [--test "..."] [--commit "..."] [--review "..."] [--provider "..."]
  cmd.command('done')
    .description('Batch mark tasks as done')
    .argument('<id...>', 'Task IDs to mark as done')
    .requiredOption('--evidence <evidence>', 'Evidence of completion')
    .option('--rule <rule>', 'Rule that verified completion')
    .option('--test <test>', 'Test results or test command output')
    .option('--commit <commit>', 'Commit SHA or reference')
    .option('--review <review>', 'Review reference or reviewer')
    .option('--provider <provider>', 'Provider/model/usage evidence')
    .option('--notes <notes>', 'Additional completion notes')
    .action((ids: string[], opts: { evidence: string; rule?: string; test?: string; commit?: string; review?: string; provider?: string; notes?: string }) => {
      try {
        const doc = readLedger()
        // Build structured evidence string from flags
        const parts: string[] = [opts.evidence]
        if (opts.test) parts.push(`[test: ${opts.test}]`)
        if (opts.commit) parts.push(`[commit: ${opts.commit}]`)
        if (opts.review) parts.push(`[review: ${opts.review}]`)
        if (opts.provider) parts.push(`[provider: ${opts.provider}]`)
        if (opts.notes) parts.push(`[notes: ${opts.notes}]`)
        const evidence = parts.join(' ')
        const results = markTasksDone(doc, ids, evidence, opts.rule)
        writeLedger(doc)

        console.log(`Marked ${results.length} task(s) as done:`)
        for (const t of results) {
          console.log(`  ${t.id}  ${t.name}`)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task block <id...> --reason "..."
  cmd.command('block')
    .description('Batch block tasks')
    .argument('<id...>', 'Task IDs to block')
    .requiredOption('--reason <reason>', 'Reason for blocking')
    .action((ids: string[], opts: { reason: string }) => {
      try {
        const doc = readLedger()
        const results = blockTasks(doc, ids, opts.reason)
        writeLedger(doc)

        console.log(`Blocked ${results.length} task(s):`)
        for (const t of results) {
          console.log(`  ${t.id}  ${t.name}`)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task unblock <id...>
  cmd.command('unblock')
    .description('Batch unblock tasks')
    .argument('<id...>', 'Task IDs to unblock')
    .action((ids: string[]) => {
      try {
        const doc = readLedger()
        const results = unblockTasks(doc, ids)
        writeLedger(doc)

        console.log(`Unblocked ${results.length} task(s):`)
        for (const t of results) {
          console.log(`  ${t.id}  ${t.name}`)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task approve <id> --by <human>
  cmd.command('approve')
    .description('Approve a high-risk task for round inclusion')
    .argument('<id>', 'Task ID to approve')
    .requiredOption('--by <name>', 'Approver name')
    .action((id: string, opts: { by: string }) => {
      try {
        const doc = readLedger()
        const task = doc.tasks.find((t) => t.id === id)
        if (!task) throw new Error(`Task "${id}" not found`)
        if (task.status === 'done') throw new Error(`Task "${id}" is already done`)
        task.approvedBy = opts.by
        writeLedger(doc)
        console.log(`Approved ${task.id} by ${opts.by}`)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  // tally task list [filters]
  cmd.command('list')
    .description('Filterable task list')
    .option('--status <status>', 'Filter by status')
    .option('--module <module>', 'Filter by module ID')
    .option('--stage <stage>', 'Filter by stage ID')
    .option('--priority <priority>', 'Filter by priority (P0, P1, P2)')
    .option('--tag <tag>', 'Filter by tag')
    .option('--feature <feature>', 'Filter by feature ID')
    .option('--search <text>', 'Search by name or ID')
    .option('--json', 'Output as JSON')
    .action((opts: { status?: string; module?: string; stage?: string; priority?: string; tag?: string; feature?: string; search?: string; json?: boolean }) => {
      try {
        const doc = readLedger()
        const tasks = listTasks(doc, {
          status: opts.status,
          module: opts.module,
          stage: opts.stage,
          priority: opts.priority,
          tag: opts.tag,
          feature: opts.feature,
          search: opts.search,
        })

        if (opts.json) {
          console.log(JSON.stringify(tasks, null, 2))
        } else {
          console.log(formatTaskTable(tasks))
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  return cmd
}
