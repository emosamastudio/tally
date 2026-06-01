import { Command } from 'commander'
import { readFileSync } from 'fs'
import { writeLedger } from '../ledger-writer.js'
import { lintDocument } from '../schema.js'
import type { TallyDocument, Task, TaskStatus, Priority } from '../types.js'

// ── Status label mapping (Chinese → English) ──

const STATUS_MAP: Record<string, TaskStatus> = {
  '待处理': 'pending',
  '进行中': 'in_progress',
  '阻塞': 'blocked',
  'hold': 'hold',
  'Hold': 'hold',
  '暂缓': 'deferred',
  '已完成': 'done',
}

const PRIORITY_MAP: Record<string, Priority> = {
  'P0': 'P0',
  'P1': 'P1',
  'P2': 'P2',
  '高': 'P0',
  '中': 'P1',
  '低': 'P2',
}

// ── Markdown table parser ──

interface ParsedRow {
  cells: string[]
}

/**
 * Parse a Markdown-style pipe table line into cells.
 * Splits on `|`, trims each cell, and filters empty leading/trailing segments.
 */
function parseRow(line: string): ParsedRow | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null

  // Split by pipe, trim each cell
  const cells = trimmed
    .split('|')
    .map((c) => c.trim())

  // Remove leading empty (before first |) and trailing empty (after last |)
  if (cells.length > 0 && cells[0] === '') cells.shift()
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()

  if (cells.length === 0) return null
  return { cells }
}

/**
 * Check if a row is a separator row (e.g., |---|---|).
 */
function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{3,}:?$/.test(c))
}

/**
 * Find the column index for a given header name. Case-insensitive trim match.
 */
function findColumn(headers: string[], name: string): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase())
}

/**
 * Parse a Markdown table into an array of Task objects.
 *
 * Expected headers (Chinese table format):
 *   ID | 阶段 | 任务 | 优先级 | 状态 | 验收标准 | 依赖关系 | 阻塞/风险 | 下一步动作
 */
function parseMarkdownTasks(markdown: string): Task[] {
  const lines = markdown.split('\n')
  const tasks: Task[] = []
  let headers: string[] | null = null
  let columnMap: Record<string, number> | null = null

  for (const line of lines) {
    const row = parseRow(line)
    if (!row) continue

    // Skip separator rows
    if (isSeparatorRow(row.cells)) continue

    // First non-separator row is the header
    if (headers === null) {
      headers = row.cells
      columnMap = {
        id: findColumn(headers, 'id'),
        stage: findColumn(headers, '阶段'),
        name: findColumn(headers, '任务'),
        priority: findColumn(headers, '优先级'),
        status: findColumn(headers, '状态'),
        acceptance: findColumn(headers, '验收标准'),
        deps: findColumn(headers, '依赖关系'),
        blocks: findColumn(headers, '阻塞/风险'),
        nextAction: findColumn(headers, '下一步动作'),
      }
      continue
    }

    // Data row
    const c = columnMap!
    const id = c.id >= 0 ? row.cells[c.id]?.trim() ?? '' : ''
    if (!id) continue

    const rawStatus = c.status >= 0 ? (row.cells[c.status]?.trim() ?? '') : ''
    const status: TaskStatus = STATUS_MAP[rawStatus] ?? 'pending'

    const rawPriority = c.priority >= 0 ? (row.cells[c.priority]?.trim() ?? '') : ''
    const priority: Priority = PRIORITY_MAP[rawPriority] ?? 'P2'

    const stage = c.stage >= 0 ? (row.cells[c.stage]?.trim() ?? '') : ''
    const name = c.name >= 0 ? (row.cells[c.name]?.trim() ?? '') : ''
    const acceptance = c.acceptance >= 0 ? (row.cells[c.acceptance]?.trim() ?? '') : ''
    const depsRaw = c.deps >= 0 ? (row.cells[c.deps]?.trim() ?? '') : ''
    const deps = depsRaw && depsRaw !== '-' ? depsRaw.split(/[,，]\s*/).filter(Boolean) : []
    const blocksRaw = c.blocks >= 0 ? (row.cells[c.blocks]?.trim() ?? '') : ''
    const blocks = blocksRaw && blocksRaw !== '-' ? blocksRaw : null
    const nextActionRaw = c.nextAction >= 0 ? (row.cells[c.nextAction]?.trim() ?? '') : ''
    const nextAction = (nextActionRaw && nextActionRaw !== '-') ? nextActionRaw : (status !== 'done' ? '待定义' : null)

    const now = new Date().toISOString().slice(0, 10)
    const createdAt = now
    const completedAt = status === 'done' ? now : null
    const evidence = status === 'done' ? 'Imported from Markdown ledger' : null

    tasks.push({
      id,
      status,
      priority,
      stage,
      module: '',
      name,
      acceptance,
      deps,
      blocks,
      nextAction,
      evidence,
      rule: null,
      aodsRefs: [],
      codeRefs: [],
      implementationTargets: [],
      feature: null,
      tags: [],
      order: null,
      completedOrder: null,
      claimedBy: null,
      claimedAt: null,
      createdAt,
      completedAt,
      writeScopes: [],
      acceptanceCriteria: null,
      executionPlan: null,
      riskLevel: 'medium',
      rollbackPlan: null,
      executionLane: null,
      assignedAgent: null,
      requiresReview: false,
      resourceRequirements: [],
      repos: [],
      deliveryNode: null,
      approvedBy: null,
    })
  }

  return tasks
}

// ── Command ──

export function migrateCommand(): Command {
  const cmd = new Command('migrate')
  cmd.description('Import Markdown task ledgers into .tally/tally.json')
    .requiredOption('--from <source>', 'Source format (tally-v0-markdown)')
    .requiredOption('--source <path...>', 'Path(s) to Markdown task files')
    .action((opts: { from: string; source: string[] }) => {
      try {
        if (opts.from !== 'tally-v0-markdown') {
          console.error(`Unknown source format: "${opts.from}". Only "tally-v0-markdown" is supported.`)
          process.exit(2)
        }

        const allTasks: Task[] = []
        const seenIds = new Set<string>()

        for (const path of opts.source) {
          let content: string
          try {
            content = readFileSync(path, 'utf-8')
          } catch {
            console.error(`Cannot read file: ${path}`)
            process.exit(1)
          }

          const tasks = parseMarkdownTasks(content)

          // Deduplicate by ID across sources
          for (const t of tasks) {
            if (seenIds.has(t.id)) {
              console.warn(`Skipping duplicate task ID "${t.id}" from ${path}`)
              continue
            }
            seenIds.add(t.id)
            allTasks.push(t)
          }

          console.log(`Parsed ${tasks.length} tasks from ${path}`)
        }

        // Build the tally document
        const now = new Date().toISOString().slice(0, 10)
        const doc: TallyDocument = {
          _meta: {
            project: 'migrated',
            tally_version: '1.0',
            created: now,
            updated: now,
            agents: [{ id: 'main', name: '主会话' }],
            stages: [],
            modules: [],
            features: [],
          },
          tasks: allTasks,
          rounds: [],
          blocks: [],
          progress: [],
        }

        // Validate before writing
        const result = lintDocument(doc)
        if (!result.valid) {
          console.error('Migration produced an invalid document:')
          for (const e of result.errors) {
            console.error(`  ${e.path}: ${e.message}`)
          }
          process.exit(4)
        }

        writeLedger(doc)
        console.log(`Imported ${allTasks.length} total tasks to .tally/tally.json`)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
