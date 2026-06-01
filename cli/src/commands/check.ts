import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { validateDocument } from '../schema.js'

export function checkCommand(): Command {
  const cmd = new Command('check')
  cmd.description('Deep validation: reference integrity, cycles, drift detection, integration')
    .option('--json', 'Output JSON')
    .option('--strict', 'Treat warnings (drift, stale, etc.) as errors')
    .action((opts: { json: boolean; strict?: boolean }) => {
      try {
        const doc = readLedger()
        const result = validateDocument(doc)
        const hasWarnings = result.warnings.length > 0
        const hasErrors = result.errors.length > 0
        const failed = hasErrors || (opts.strict && hasWarnings)

        if (opts.json) {
          console.log(JSON.stringify({ ...result, strict: opts.strict ?? false, failed }, null, 2))
        } else {
          if (!failed) {
            console.log('.tally/tally.json: all checks passed')
            if (hasWarnings) {
              console.log(`  ${result.warnings.length} warning(s) (use --strict to block):`)
            }
          }
          for (const w of result.warnings) {
            const label = opts.strict ? 'ERROR' : 'WARN'
            console.warn(`  ${label} ${w.code}: ${w.message}`)
          }
          for (const e of result.errors) {
            console.error(`  ERROR ${e.code}: ${e.message}`)
          }
          if (opts.strict && hasWarnings) {
            console.error(`\nStrict mode: ${result.warnings.length} warning(s) treated as errors.`)
          }
        }
        process.exit(failed ? 1 : 0)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
