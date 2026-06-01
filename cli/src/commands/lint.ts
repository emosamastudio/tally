import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { lintDocument } from '../schema.js'

export function lintCommand(): Command {
  const cmd = new Command('lint')
  cmd.description('Validate .tally/tally.json structure (fast, for pre-commit)')
    .option('--strict', 'Treat warnings as errors')
    .option('--json', 'Output JSON')
    .action((opts: { strict: boolean; json: boolean }) => {
      try {
        const doc = readLedger()
        const result = lintDocument(doc)
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
        } else if (result.valid) {
          console.log('.tally/tally.json: ok')
        } else {
          for (const e of result.errors) {
            console.error(`  ${e.path}: ${e.message}`)
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
