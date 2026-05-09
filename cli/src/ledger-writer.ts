// cli/src/ledger-writer.ts
import { writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { TallyDocument } from './types'

export function writeLedger(
  doc: TallyDocument,
  cwd: string = process.cwd(),
  filename: string = 'tally.json',
): void {
  doc._meta.updated = new Date().toISOString().slice(0, 10)
  const fullPath = join(cwd, filename)
  const tmpPath = join(cwd, `.${filename}.tmp`)
  const json = JSON.stringify(doc, null, 2) + '\n'

  writeFileSync(tmpPath, json, 'utf-8')
  renameSync(tmpPath, fullPath)
}
