import { Command } from 'commander'
import { createHash } from 'crypto'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { basename, extname, isAbsolute, relative, resolve, sep } from 'path'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import type { PlanEntry, PlanStatus, TallyDocument } from '../types.js'
import { wrapAction } from './task.js'

export interface RegisterPlanOptions {
  id?: string
  title?: string
  kind?: string
  requiredSkill?: string | null
  status?: PlanStatus
}

export interface PlanCheckIssue {
  code: string
  message: string
  path?: string
  planId?: string
  taskId?: string
}

export interface PlanCheckResult {
  valid: boolean
  errors: PlanCheckIssue[]
  warnings: PlanCheckIssue[]
}

function toStoredPath(cwd: string, absolutePath: string): string {
  const realCwd = realpathSync(cwd)
  const realPath = realpathSync(absolutePath)
  const rel = relative(realCwd, realPath)
  const stored = rel.startsWith('..') || isAbsolute(rel) ? realPath : rel
  return stored.split(sep).join('/')
}

function resolveStoredPath(cwd: string, storedPath: string): string {
  return isAbsolute(storedPath) ? storedPath : resolve(cwd, storedPath)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function defaultPlanId(title: string, path: string, contentHash: string): string {
  const base = basename(path, extname(path))
  const slug = slugify(title) || slugify(base) || contentHash.slice('sha256:'.length, 'sha256:'.length + 12)
  return `plan:${slug}`
}

export function hashPlanContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

export function derivePlanTitle(content: string, fallbackPath: string): string {
  const titleLine = content.split(/\r?\n/).find((line) => /^#\s+/.test(line))
  if (titleLine) return titleLine.replace(/^#\s+/, '').trim()
  return basename(fallbackPath, extname(fallbackPath))
}

export function registerPlan(
  doc: TallyDocument,
  cwd: string,
  planPath: string,
  options: RegisterPlanOptions = {},
): PlanEntry {
  const absolutePath = resolve(cwd, planPath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Plan file not found: ${planPath}`)
  }

  const content = readFileSync(absolutePath, 'utf-8')
  const contentHash = hashPlanContent(content)
  const title = options.title ?? derivePlanTitle(content, planPath)
  const id = options.id ?? defaultPlanId(title, planPath, contentHash)
  const now = new Date().toISOString()

  if (!doc._meta.plans) doc._meta.plans = []
  const existingIndex = doc._meta.plans.findIndex((plan) => plan.id === id)
  const existing = existingIndex >= 0 ? doc._meta.plans[existingIndex] : null

  const entry: PlanEntry = {
    id,
    path: toStoredPath(cwd, absolutePath),
    title,
    kind: options.kind ?? 'superpowers',
    requiredSkill: options.requiredSkill === undefined ? 'superpowers:subagent-driven-development' : options.requiredSkill,
    contentHash,
    status: options.status ?? existing?.status ?? 'active',
    registeredAt: existing?.registeredAt ?? now,
    updatedAt: now,
  }

  if (existingIndex >= 0) {
    doc._meta.plans[existingIndex] = entry
  } else {
    doc._meta.plans.push(entry)
  }
  doc._meta.updated = now.slice(0, 10)

  return entry
}

function hasPlanTaskRef(content: string, taskRef: string): boolean {
  return content.includes(taskRef)
}

export function checkPlans(doc: TallyDocument, cwd: string): PlanCheckResult {
  const errors: PlanCheckIssue[] = []
  const warnings: PlanCheckIssue[] = []
  const plans = doc._meta.plans ?? []
  const planById = new Map<string, PlanEntry>()
  const contentByPlanId = new Map<string, string>()

  for (const plan of plans) {
    if (planById.has(plan.id)) {
      errors.push({
        code: 'PLAN_ID_DUPLICATE',
        message: `Duplicate plan id "${plan.id}"`,
        planId: plan.id,
      })
      continue
    }
    planById.set(plan.id, plan)

    const absolutePath = resolveStoredPath(cwd, plan.path)
    if (!existsSync(absolutePath)) {
      errors.push({
        code: 'PLAN_FILE_MISSING',
        message: `Registered plan "${plan.id}" file is missing: ${plan.path}`,
        path: plan.path,
        planId: plan.id,
      })
      continue
    }

    const content = readFileSync(absolutePath, 'utf-8')
    contentByPlanId.set(plan.id, content)
    const currentHash = hashPlanContent(content)
    if (currentHash !== plan.contentHash) {
      errors.push({
        code: 'PLAN_HASH_DRIFT',
        message: `Registered plan "${plan.id}" content hash changed`,
        path: plan.path,
        planId: plan.id,
      })
    }
  }

  for (const task of doc.tasks) {
    const planRef = task.planRef ?? null
    if (!planRef) {
      if (task.planPath || task.planTaskRef || task.planContentHash) {
        warnings.push({
          code: 'TASK_PLAN_PARTIAL_REF',
          message: `Task "${task.id}" has plan metadata but no planRef`,
          taskId: task.id,
        })
      }
      continue
    }

    const plan = planById.get(planRef)
    if (!plan) {
      errors.push({
        code: 'TASK_PLAN_UNKNOWN',
        message: `Task "${task.id}" references unknown plan "${planRef}"`,
        taskId: task.id,
        planId: planRef,
      })
      continue
    }

    if (task.planPath && task.planPath !== plan.path) {
      warnings.push({
        code: 'TASK_PLAN_PATH_STALE',
        message: `Task "${task.id}" planPath differs from registered plan path`,
        taskId: task.id,
        planId: plan.id,
      })
    }
    if (task.planContentHash && task.planContentHash !== plan.contentHash) {
      warnings.push({
        code: 'TASK_PLAN_HASH_STALE',
        message: `Task "${task.id}" planContentHash differs from registered plan hash`,
        taskId: task.id,
        planId: plan.id,
      })
    }

    const taskRef = task.planTaskRef ?? null
    const content = contentByPlanId.get(plan.id)
    if (taskRef && content && !hasPlanTaskRef(content, taskRef)) {
      errors.push({
        code: 'PLAN_TASK_REF_MISSING',
        message: `Task "${task.id}" planTaskRef "${taskRef}" was not found in plan "${plan.id}"`,
        taskId: task.id,
        planId: plan.id,
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

function formatPlanCheck(result: PlanCheckResult): string {
  const lines: string[] = []
  lines.push(result.valid ? 'Plan check: PASS' : `Plan check: ${result.errors.length} error(s)`)
  for (const error of result.errors) {
    lines.push(`  ERROR ${error.code}: ${error.message}`)
  }
  for (const warning of result.warnings) {
    lines.push(`  WARN ${warning.code}: ${warning.message}`)
  }
  return lines.join('\n')
}

export function planCommand(): Command {
  const cmd = new Command('plan')
  cmd.description('Register and check external implementation plans')

  cmd.command('register')
    .description('Register a Superpowers-style implementation plan in the ledger')
    .argument('<path>', 'Plan markdown path')
    .option('--id <id>', 'Plan id to store in _meta.plans')
    .option('--title <title>', 'Plan title override')
    .option('--kind <kind>', 'Plan kind', 'superpowers')
    .option('--required-skill <skill>', 'Required execution skill', 'superpowers:subagent-driven-development')
    .option('--status <status>', 'Plan status: active, archived, superseded', 'active')
    .option('--json-output', 'Output result as JSON')
    .action((planPath: string, opts: { id?: string; title?: string; kind?: string; requiredSkill?: string; status?: PlanStatus; jsonOutput?: boolean }) => {
      wrapAction({ json: opts.jsonOutput }, () => {
        const cwd = process.cwd()
        const doc = readLedger(cwd)
        const entry = registerPlan(doc, cwd, planPath, {
          id: opts.id,
          title: opts.title,
          kind: opts.kind,
          requiredSkill: opts.requiredSkill === '' ? null : opts.requiredSkill,
          status: opts.status,
        })
        writeLedger(doc, cwd)

        if (opts.jsonOutput) {
          console.log(JSON.stringify({ ok: true, plan: entry }))
        } else {
          console.log(`Registered plan ${entry.id}: ${entry.path}`)
          console.log(`  Title: ${entry.title}`)
          console.log(`  Hash:  ${entry.contentHash}`)
        }
      })
    })

  cmd.command('list')
    .description('List registered plans')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const doc = readLedger()
      const plans = doc._meta.plans ?? []
      if (opts.json) {
        console.log(JSON.stringify(plans, null, 2))
        return
      }
      if (plans.length === 0) {
        console.log('(no registered plans)')
        return
      }
      for (const plan of plans) {
        console.log(`${plan.id}  ${plan.status}  ${plan.path}`)
      }
    })

  cmd.command('check')
    .description('Check registered plans and task plan references')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const cwd = process.cwd()
      const doc = readLedger(cwd)
      const result = checkPlans(doc, cwd)
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(formatPlanCheck(result))
      }
      if (!result.valid) process.exit(1)
    })

  return cmd
}
