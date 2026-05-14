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

// ── Command ──

export function exportCommand(): Command {
  const cmd = new Command('export')
  cmd.description('Export tally.json to stdout in the specified format')
    .requiredOption('--format <format>', 'Output format: json, csv, or markdown')
    .action((opts: { format: string }) => {
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
          default:
            console.error(`Unknown format: "${opts.format}". Use json, csv, or markdown.`)
            process.exit(2)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
