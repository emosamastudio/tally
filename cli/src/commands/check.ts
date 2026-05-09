import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { validateDocument } from '../schema.js'

export function checkCommand(): Command {
  const cmd = new Command('check')
  cmd.description('Deep validation: reference integrity, cycles, progress cross-check')
    .option('--json', 'Output JSON')
    .action((opts: { json: boolean }) => {
      try {
        const doc = readLedger()
        const result = validateDocument(doc)
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          if (result.valid) {
            console.log('tally.json: all checks passed')
          }
          for (const w of result.warnings) {
            console.warn(`  WARN ${w.code}: ${w.message}`)
          }
          for (const e of result.errors) {
            console.error(`  ERROR ${e.code}: ${e.message}`)
          }
        }
        process.exit(result.valid ? 0 : 1)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
