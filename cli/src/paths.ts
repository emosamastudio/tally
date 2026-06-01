import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

export const DEFAULT_LEDGER_PATH = '.tally/tally.json'
export const DEFAULT_LOCAL_CONFIG_PATH = '.tally/config.yaml'

export function resolveLedgerPath(
  cwd: string = process.cwd(),
): string {
  return join(cwd, DEFAULT_LEDGER_PATH)
}

export function findLedgerPathUp(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const hidden = join(dir, DEFAULT_LEDGER_PATH)
    if (existsSync(hidden)) return hidden

    const parent = join(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}

export function resolveLocalConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, DEFAULT_LOCAL_CONFIG_PATH)
}

export function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}
