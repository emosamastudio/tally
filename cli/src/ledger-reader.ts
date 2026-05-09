// cli/src/ledger-reader.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import type { TallyDocument } from './types.js'

const DEFAULT_PATH = 'tally.json'

export function readLedger(cwd: string = process.cwd(), filename: string = DEFAULT_PATH): TallyDocument {
  const fullPath = join(cwd, filename)
  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    throw new Error(`tally.json not found at ${fullPath}. Run 'tally init' first.`)
  }
  try {
    return JSON.parse(raw) as TallyDocument
  } catch (e) {
    throw new Error(`tally.json at ${fullPath} is not valid JSON: ${(e as Error).message}`)
  }
}

export function ledgerPath(cwd: string = process.cwd(), filename: string = DEFAULT_PATH): string {
  return join(cwd, filename)
}
