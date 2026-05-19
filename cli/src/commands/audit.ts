// cli/src/commands/audit.ts
import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import type { TallyDocument } from '../types.js'

export interface AuditResult {
  total: number
  done: number
  open: number
  missing: {
    taskId: string
    name: string
    status: string
    missingFields: string[]
  }[]
}

const AUDITABLE_FIELDS = [
  'feature',
  'acceptanceCriteria',
  'executionPlan',
  'writeScopes',
  'deliveryNode',
  'executionLane',
  'repos',
  'rollbackPlan',
  'resourceRequirements',
] as const

function auditBacklog(doc: TallyDocument, fields: string[]): AuditResult {
  const checkFields = fields.length > 0 ? fields : [...AUDITABLE_FIELDS]
  const missing: AuditResult['missing'] = []

  for (const task of doc.tasks) {
    const missingFields: string[] = []
    for (const field of checkFields) {
      const value = (task as unknown as Record<string, unknown>)[field]
      if (value === null || value === undefined) {
        missingFields.push(field)
      } else if (Array.isArray(value) && value.length === 0) {
        // Empty arrays for writeScopes/repos count as missing for audit purposes
        if (field === 'writeScopes' || field === 'repos' || field === 'resourceRequirements') {
          missingFields.push(field)
        }
      }
    }
    if (missingFields.length > 0) {
      missing.push({
        taskId: task.id,
        name: task.name,
        status: task.status,
        missingFields,
      })
    }
  }

  return {
    total: doc.tasks.length,
    done: doc.tasks.filter((t) => t.status === 'done').length,
    open: doc.tasks.filter((t) => t.status !== 'done').length,
    missing,
  }
}

export function auditCommand(): Command {
  const cmd = new Command('audit')
  cmd.description('Audit task ledger for missing fields and schema gaps')

  cmd.command('backlog')
    .description('Find tasks missing specified fields')
    .option('--missing <fields>', 'Comma-separated field names to check (default: all auditable fields)')
    .option('--json', 'Output as JSON')
    .action((opts: { missing?: string; json?: boolean }) => {
      try {
        const doc = readLedger()
        const fields = opts.missing ? opts.missing.split(',').map((f) => f.trim()) : []
        const result = auditBacklog(doc, fields)

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(`Audit: ${result.total} tasks (${result.done} done, ${result.open} open)`)
          console.log(`Missing fields: ${result.missing.length} task(s)`)
          for (const m of result.missing) {
            console.log(`  ${m.taskId} [${m.status}] ${m.name}`)
            console.log(`    missing: ${m.missingFields.join(', ')}`)
          }
          if (result.missing.length === 0) {
            console.log('  (all tasks have complete metadata)')
          }
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })

  return cmd
}
