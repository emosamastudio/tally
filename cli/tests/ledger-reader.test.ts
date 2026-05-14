import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { readLedger } from '../src/ledger-reader'
import { writeLedger } from '../src/ledger-writer'
import type { TallyDocument } from '../src/types'

const validDoc: TallyDocument = {
  _meta: {
    project: 'test',
    tally_version: '1.0',
    created: '2026-05-10',
    updated: '2026-05-10',
    agents: [{ id: 'main', name: '主会话' }],
    stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
    modules: [{ id: 'core', name: 'Core Module' }],
    features: [],
  },
  tasks: [],
  rounds: [],
  blocks: [],
  progress: [],
}

describe('ledger-reader', () => {
  let dir: string

  beforeEach(() => { dir = mkdtempSync('/tmp/tally-test-') })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads a valid tally.json', () => {
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(validDoc, null, 2))
    const doc = readLedger(dir)
    expect(doc._meta.project).toBe('test')
  })

  it('throws on missing file', () => {
    expect(() => readLedger(dir)).toThrow(/not found/)
  })

  it('throws on invalid JSON', () => {
    writeFileSync(join(dir, 'tally.json'), 'not json')
    expect(() => readLedger(dir)).toThrow(/not valid JSON/)
  })
})

describe('ledger-writer', () => {
  let dir: string

  beforeEach(() => { dir = mkdtempSync('/tmp/tally-test-') })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('writes and round-trips', () => {
    writeLedger(validDoc, dir)
    const doc = readLedger(dir)
    expect(doc._meta.project).toBe('test')
  })

  it('updates _meta.updated on write', () => {
    writeLedger(validDoc, dir)
    const doc = readLedger(dir)
    expect(doc._meta.updated).toBe(new Date().toISOString().slice(0, 10))
  })
})
