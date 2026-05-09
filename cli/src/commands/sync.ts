import { execSync } from 'child_process'
import { Command } from 'commander'

export function syncCommand(): Command {
  const cmd = new Command('sync')
  cmd.description('Git add, commit, and push tally.json')
    .action(() => {
      try {
        execSync('git add tally.json', { stdio: 'pipe' })
        try {
          execSync('git commit -m "tally: sync"', { stdio: 'pipe' })
        } catch {
          // commit may fail if nothing to commit (empty)
          console.log('Nothing to sync')
          process.exit(0)
        }
        try {
          execSync('git push', { stdio: 'inherit' })
        } catch {
          // Push failed — try pull + rebase
          console.warn('Push failed, trying pull --rebase...')
          execSync('git pull --rebase', { stdio: 'inherit' })
          // Re-run validation
          const { validateDocument } = require('../schema.js')
          const { readLedger } = require('../ledger-reader.js')
          const doc = readLedger()
          const result = validateDocument(doc)
          if (!result.valid) {
            console.error('tally.json is invalid after merge. Resolve conflicts manually.')
            process.exit(4)
          }
          execSync('git push', { stdio: 'inherit' })
        }
        console.log('Synced.')
      } catch (e) {
        console.error('Sync failed:', (e as Error).message)
        process.exit(4)
      }
    })
  return cmd
}
