import { Command } from 'commander'
import { readLedger, ledgerPath } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import { lintDocument } from '../schema.js'
import type { TallyDocument } from '../types.js'

// ── Migration functions ──

type MigrationFn = (doc: TallyDocument) => TallyDocument

/**
 * Migration registry: version string → transformation function.
 * Each function returns the document upgraded to the next version.
 * Currently only v1.0 exists, so the registry is empty (no migrations needed).
 * When v1.1+ is defined, add entries like:
 *   '1.0': (doc) => { doc._meta.tally_version = '1.1'; return doc; }
 */
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

/**
 * Apply all relevant migrations in order to bring the document up to CURRENT_VERSION.
 */
function applyMigrations(doc: TallyDocument): { doc: TallyDocument; applied: string[] } {
  const startVersion = doc._meta.tally_version
  const startNum = getVersionNumber(startVersion)
  const currentNum = getVersionNumber(CURRENT_VERSION)

  if (startNum >= currentNum) {
    return { doc, applied: [] }
  }

  const applied: string[] = []
  let current = doc

  // Collect available migration keys in version order
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

  // Ensure version is set to current
  current._meta.tally_version = CURRENT_VERSION

  return { doc: current, applied }
}

// ── Command ──

export function upgradeCommand(): Command {
  const cmd = new Command('upgrade')
  cmd.description('Upgrade tally.json to the latest schema version')
    .action(() => {
      try {
        const doc = readLedger()
        const currentVersion = doc._meta.tally_version

        if (currentVersion === CURRENT_VERSION) {
          console.log(`tally.json is already at the latest version (${CURRENT_VERSION})`)
          process.exit(0)
        }

        // Run lint first to ensure clean starting state
        const preLint = lintDocument(doc)
        if (!preLint.valid) {
          console.error('tally.json has lint errors. Fix them before upgrading:')
          for (const e of preLint.errors) {
            console.error(`  ${e.path}: ${e.message}`)
          }
          process.exit(3)
        }

        const { doc: upgraded, applied } = applyMigrations(doc)

        if (applied.length === 0) {
          console.log(`No migrations available to upgrade from ${currentVersion}`)
          process.exit(0)
        }

        // Validate after migration
        const postLint = lintDocument(upgraded)
        if (!postLint.valid) {
          console.error('Migration produced an invalid document:')
          for (const e of postLint.errors) {
            console.error(`  ${e.path}: ${e.message}`)
          }
          process.exit(4)
        }

        writeLedger(upgraded)
        const path = ledgerPath()

        console.log(`Upgraded tally.json from ${currentVersion} → ${CURRENT_VERSION}`)
        console.log(`Applied migrations: ${applied.join(', ')}`)
        console.log(`Written to ${path}`)
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
