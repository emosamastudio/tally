import { Command } from 'commander'
import { readLedger, ledgerPath } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import { lintDocument } from '../schema.js'
import type { TallyDocument } from '../types.js'

// Versioned migrations only. Tally no longer backfills pre-current ledger shapes.
type MigrationFn = (doc: TallyDocument) => TallyDocument

const MIGRATIONS: Record<string, MigrationFn> = {}
const CURRENT_VERSION = '1.0'

function getVersionNumber(version: string): number {
  const parts = version.split('.')
  if (parts.length < 2) return 0
  const major = parseInt(parts[0], 10)
  const minor = parseInt(parts[1], 10)
  if (isNaN(major) || isNaN(minor)) return 0
  return major * 1000 + minor
}

function applyMigrations(doc: TallyDocument): { doc: TallyDocument; applied: string[] } {
  const startVersion = doc._meta.tally_version
  const startNum = getVersionNumber(startVersion)
  const currentNum = getVersionNumber(CURRENT_VERSION)

  if (startNum >= currentNum) return { doc, applied: [] }

  const applied: string[] = []
  let current = doc

  const availableVersions = Object.keys(MIGRATIONS).sort(
    (a, b) => getVersionNumber(a) - getVersionNumber(b),
  )

  for (const version of availableVersions) {
    const verNum = getVersionNumber(version)
    if (verNum > startNum && verNum <= currentNum) {
      current = MIGRATIONS[version](current)
      applied.push(version)
    }
  }

  current._meta.tally_version = CURRENT_VERSION
  return { doc: current, applied }
}

export function upgradeCommand(): Command {
  const cmd = new Command('upgrade')
  cmd.description('Upgrade .tally/tally.json to the latest schema version')
    .action(() => {
      try {
        const doc = readLedger()
        const currentVersion = doc._meta.tally_version

        const preLint = lintDocument(doc)
        if (!preLint.valid) {
          console.error('.tally/tally.json has lint errors. Fix them before upgrading:')
          for (const e of preLint.errors) {
            console.error(`  ${e.path}: ${e.message}`)
          }
          process.exit(3)
        }

        if (currentVersion === CURRENT_VERSION) {
          console.log(`.tally/tally.json is already at the latest version (${CURRENT_VERSION})`)
          process.exit(0)
        }

        const { doc: upgraded, applied } = applyMigrations(doc)

        if (applied.length === 0) {
          console.log(`No migrations available to upgrade from ${currentVersion}`)
          process.exit(0)
        }

        const postLint = lintDocument(upgraded)
        if (!postLint.valid) {
          console.error('Migration produced an invalid document:')
          for (const e of postLint.errors) {
            console.error(`  ${e.path}: ${e.message}`)
          }
          process.exit(4)
        }

        writeLedger(upgraded)
        console.log(`Upgraded .tally/tally.json from ${currentVersion} -> ${CURRENT_VERSION}`)
        console.log(`Applied migrations: ${applied.join(', ')}`)
        console.log(`Written to ${ledgerPath()}`)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
