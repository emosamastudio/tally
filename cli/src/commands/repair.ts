import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import { backfillTaskEvidence, buildStructuredEvidence, summarizeEvidenceRepair } from '../evidence.js'
import { wrapAction } from './task.js'

export function repairCommand(): Command {
  const cmd = new Command('repair')
  cmd.description('Explicit repair workflows for historical ledgers')

  cmd.command('missing-evidence')
    .description('Backfill evidence for done tasks that have null evidence')
    .option('--evidence <evidence>', 'Historical evidence text to record')
    .option('--test <test>', 'Test context; use honest historical wording if not rerun')
    .option('--commit <commit>', 'Commit SHA or reference')
    .option('--review <review>', 'Review context; use honest historical wording if review was absent')
    .option('--provider <provider>', 'Provider/model/usage evidence')
    .option('--notes <notes>', 'Additional repair notes')
    .option('--no-forbidden', 'Confirm no forbidden side effects were triggered')
    .option('--allow-missing-review', 'Allow requiresReview done tasks without [review:] evidence')
    .option('--dry-run', 'Report affected tasks without writing')
    .option('--json', 'Output JSON')
    .action((opts: {
      evidence?: string
      test?: string
      commit?: string
      review?: string
      provider?: string
      notes?: string
      forbidden?: boolean
      allowMissingReview?: boolean
      dryRun?: boolean
      json?: boolean
    }) => {
      wrapAction({ json: opts.json }, () => {
        const doc = readLedger()
        const summary = summarizeEvidenceRepair(doc)
        if (opts.dryRun) {
          if (opts.json) {
            console.log(JSON.stringify({
              ok: true,
              dryRun: true,
              repair: summary,
              evidence: opts.evidence ? buildStructuredEvidence({
                ...opts,
                evidence: opts.evidence,
                noForbidden: opts.forbidden === false,
              }) : null,
            }, null, 2))
          } else {
            console.log(`Missing evidence: ${summary.missingDoneEvidence} done task(s)`)
            for (const id of summary.taskIds) console.log(`  ${id}`)
          }
          return
        }

        if (!opts.evidence) {
          throw new Error('--evidence is required unless --dry-run is set')
        }

        const evidence = buildStructuredEvidence({
          ...opts,
          evidence: opts.evidence,
          noForbidden: opts.forbidden === false,
        })

        if (summary.taskIds.length === 0) {
          if (opts.json) {
            console.log(JSON.stringify({
              ok: true,
              repaired: [],
              repair: summary,
            }, null, 2))
          } else {
            console.log('No done tasks are missing evidence.')
          }
          return
        }

        const results = backfillTaskEvidence(doc, summary.taskIds, evidence, {
          allowMissingReview: opts.allowMissingReview,
        })
        writeLedger(doc)

        if (opts.json) {
          console.log(JSON.stringify({
            ok: true,
            repaired: results.map((r) => ({
              id: r.task.id,
              name: r.task.name,
              action: r.action,
              evidence: r.evidence,
            })),
            repair: summarizeEvidenceRepair(doc),
          }, null, 2))
        } else {
          console.log(`Repaired missing evidence for ${results.length} done task(s):`)
          for (const r of results) {
            console.log(`  ${r.task.id}: ${r.task.name}`)
          }
        }
      })
    })

  return cmd
}
