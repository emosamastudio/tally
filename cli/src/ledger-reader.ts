// cli/src/ledger-reader.ts
import { readFileSync } from 'fs'
import type { TallyDocument } from './types.js'
import { resolveLedgerPath } from './paths.js'

export function readLedger(cwd: string = process.cwd()): TallyDocument {
  const fullPath = resolveLedgerPath(cwd)
  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    throw new Error(`Tally ledger not found at ${fullPath}. Run 'tally init' first.`)
  }
  try {
    return JSON.parse(raw) as TallyDocument
  } catch (e) {
    throw new Error(`Tally ledger at ${fullPath} is not valid JSON: ${(e as Error).message}`)
  }
}

export function ledgerPath(cwd: string = process.cwd()): string {
  return resolveLedgerPath(cwd)
}
