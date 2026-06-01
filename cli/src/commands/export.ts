import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import type { TallyDocument } from '../types.js'

// ── JSON export ──

function exportJson(doc: TallyDocument): string {
  return JSON.stringify(doc, null, 2)
}

// ── CSV export ──

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function exportCsv(doc: TallyDocument): string {
  const headers = [
    'id', 'name', 'status', 'priority', 'stage', 'module', 'feature',
    'deps', 'evidence', 'createdAt', 'completedAt',
  ]
  const lines: string[] = [headers.join(',')]

  for (const t of doc.tasks) {
    const row = [
      csvEscape(t.id),
      csvEscape(t.name),
      csvEscape(t.status),
      csvEscape(t.priority),
      csvEscape(t.stage),
      csvEscape(t.module),
      csvEscape(t.feature),
      csvEscape(t.deps.join(';')),
      csvEscape(t.evidence),
      csvEscape(t.createdAt),
      csvEscape(t.completedAt),
    ]
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

// ── Markdown export ──

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  blocked: '阻塞',
  hold: 'Hold',
  deferred: '暂缓',
  done: '已完成',
}

const PRIORITY_LABELS: Record<string, string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
}

function exportMarkdown(doc: TallyDocument): string {
  const headers = [
    'ID', '阶段', '模块', '功能', '任务', '优先级', '状态', '验收标准', '依赖关系', '阻塞/风险', '下一步动作',
  ]
  const lines: string[] = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ]

  for (const t of doc.tasks) {
    const cols = [
      t.id,
      t.stage,
      t.module,
      t.feature ?? '-',
      t.name,
      PRIORITY_LABELS[t.priority] ?? t.priority,
      STATUS_LABELS[t.status] ?? t.status,
      t.acceptance,
      t.deps.join(', ') || '-',
      t.blocks ?? '-',
      t.nextAction ?? '-',
    ]
    lines.push(`| ${cols.join(' | ')} |`)
  }

  return lines.join('\n')
}

// ── Agent Brief export ──

function exportAgentBrief(doc: TallyDocument, taskId?: string): string {
  const tasks = taskId
    ? doc.tasks.filter((t) => t.id === taskId || t.id === taskId.replace(/^[UD]-/, 'U-') || t.id === taskId.replace(/^[UD]-/, 'D-'))
    : doc.tasks.filter((t) => t.status !== 'done')

  if (tasks.length === 0) return '(no matching tasks)'

  const parts: string[] = []
  for (const t of tasks) {
    const feat = t.feature ? doc._meta.features.find((f) => f.id === t.feature) : null
    const plan = t.planRef ? (doc._meta.plans ?? []).find((p) => p.id === t.planRef) : null
    const planPath = t.planPath ?? plan?.path ?? null
    const planHash = t.planContentHash ?? plan?.contentHash ?? null
    parts.push(`## ${t.id}: ${t.name}`)
    parts.push(`- **Module**: ${t.module}`)
    parts.push(`- **Feature**: ${t.feature ?? '(none)'} ${feat ? `(${feat.name})` : ''}`)
    parts.push(`- **Plan**: ${t.planRef ?? '(none)'}`)
    parts.push(`- **Plan Path**: ${planPath ?? '(none)'}`)
    parts.push(`- **Plan Task**: ${t.planTaskRef ?? '(none)'}`)
    parts.push(`- **Plan Hash**: ${planHash ?? '(none)'}`)
    parts.push(`- **Priority**: ${t.priority}`)
    parts.push(`- **Risk**: ${t.riskLevel}`)
    parts.push(`- **Lane**: ${t.executionLane ?? '(none)'}`)
    parts.push(`- **Deps**: ${t.deps.length > 0 ? t.deps.join(', ') : '(none)'}`)
    parts.push(`- **Write Scopes**: ${t.writeScopes.length > 0 ? t.writeScopes.join(', ') : '(none)'}`)
    parts.push(`- **Repos**: ${t.repos.length > 0 ? t.repos.join(', ') : '(none)'}`)
    if (t.acceptanceCriteria) {
      const ac = t.acceptanceCriteria
      parts.push(`- **Tests Required**: ${ac.requiredTests?.join(', ') ?? '(none)'}`)
      parts.push(`- **Pass Conditions**: ${ac.passConditions?.join('; ') ?? '(none)'}`)
      parts.push(`- **Forbidden**: ${ac.forbiddenSideEffects?.join('; ') ?? '(none)'}`)
      parts.push(`- **Negative Cases**: ${ac.negativeCases?.join('; ') ?? '(none)'}`)
    }
    if (t.executionPlan) {
      parts.push(`- **Inputs**: ${t.executionPlan.inputs?.join(', ') ?? '(none)'}`)
      parts.push(`- **Outputs**: ${t.executionPlan.outputs?.join(', ') ?? '(none)'}`)
      parts.push(`- **Steps**: ${t.executionPlan.steps?.join('; ') ?? '(none)'}`)
    }
    parts.push(`- **Acceptance**: ${t.acceptance}`)
    parts.push(`- **Next Action**: ${t.nextAction ?? '(none)'}`)
    parts.push(`- **Review Required**: ${t.requiresReview ? 'Yes' : 'No'}`)
    if (t.rollbackPlan) parts.push(`- **Rollback**: ${t.rollbackPlan}`)
    parts.push('')
  }
  return parts.join('\n')
}

// ── Command ──

export function exportCommand(): Command {
  const cmd = new Command('export')
  cmd.description('Export .tally/tally.json to stdout in the specified format')
    .requiredOption('--format <format>', 'Output format: json, csv, markdown, or agent-brief')
    .option('--task <id>', 'Task ID for agent-brief export')
    .action((opts: { format: string; task?: string }) => {
      try {
        const doc = readLedger()
        const fmt = opts.format.toLowerCase()

        switch (fmt) {
          case 'json':
            console.log(exportJson(doc))
            break
          case 'csv':
            console.log(exportCsv(doc))
            break
          case 'markdown':
            console.log(exportMarkdown(doc))
            break
          case 'agent-brief':
            console.log(exportAgentBrief(doc, opts.task))
            break
          default:
            console.error(`Unknown format: "${opts.format}". Use json, csv, markdown, or agent-brief.`)
            process.exit(2)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
