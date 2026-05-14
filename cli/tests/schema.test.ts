// cli/tests/schema.test.ts

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lintDocument, validateDocument, TALLY_JSON_SCHEMA } from '../src/schema.js'

const FIXTURES = join(__dirname, 'fixtures')

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(FIXTURES, name), 'utf-8')
  return JSON.parse(raw)
}

describe('TALLY_JSON_SCHEMA', () => {
  it('should be a valid JSON Schema object', () => {
    expect(TALLY_JSON_SCHEMA).toBeDefined()
    expect(TALLY_JSON_SCHEMA.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(TALLY_JSON_SCHEMA.type).toBe('object')
  })
})

describe('lintDocument', () => {
  it('should pass a valid tally document', () => {
    const doc = loadFixture('valid-tally.json')
    const result = lintDocument(doc)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail on missing evidence for done task', () => {
    const doc = loadFixture('missing-evidence.json')
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('evidence'))).toBe(true)
  })

  it('should catch duplicate task IDs', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>
    // Clone the first task to create a duplicate ID
    tasks.push({ ...tasks[0] })
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Duplicate task ID'))).toBe(true)
  })

  it('should catch duplicate order values among non-done tasks', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks.push({
      ...tasks[0],
      id: 'U-002',
      name: 'Second task with same order',
      order: 1,
    })
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Duplicate order'))).toBe(true)
  })

  it('should fail on schema-level issues (missing required field)', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    // Remove a required field from a task
    const tasks = doc.tasks as Array<Record<string, unknown>>
    delete tasks[0].name
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
  })

  it('should fail when non-done task has null nextAction', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks[0].nextAction = null
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('nextAction'))).toBe(true)
  })
})

describe('validateDocument', () => {
  it('should pass a valid tally document', () => {
    const doc = loadFixture('valid-tally.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should also fail on lint-level issues (missing evidence)', () => {
    const doc = loadFixture('missing-evidence.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path?.includes('evidence'))).toBe(true)
  })

  it('should detect dependency cycles', () => {
    const doc = loadFixture('dependency-cycle.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DEPENDENCY_CYCLE')).toBe(true)
  })

  it('should detect stale claims (reference to non-existent round)', () => {
    const doc = loadFixture('stale-claim.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.code === 'REFERENCE_INVALID' && e.path?.includes('claimedBy'),
      ),
    ).toBe(true)
  })

  it('should detect reference to non-existent task in deps', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks[0].deps = ['U-nonexistent']
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'REFERENCE_INVALID')).toBe(true)
  })

  it('should detect stale claim when claimedBy is set but claimedAt is null', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>

    // Add a round so claimedBy can reference a valid round
    ;(doc as Record<string, unknown>).rounds = [
      {
        id: 'R-test',
        start: '2026-05-10',
        executor: 'main',
        scope: 'test',
        exclusions: '',
        plannedTasks: [],
        completedAt: null,
        status: 'active',
      },
    ]

    tasks[0].claimedBy = 'R-test'
    tasks[0].claimedAt = null // missing claimedAt

    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'STALE_CLAIM')).toBe(true)
  })

  it('should detect round executor referencing non-existent agent', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    ;(doc as Record<string, unknown>).rounds = [
      {
        id: 'R-test',
        start: '2026-05-10',
        executor: 'nonexistent-agent',
        scope: 'test',
        exclusions: '',
        plannedTasks: [],
        completedAt: null,
        status: 'active',
      },
    ]
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'AGENT_REFERENCE_INVALID')).toBe(true)
  })

  it('should detect duplicate round IDs', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    ;(doc as Record<string, unknown>).rounds = [
      {
        id: 'R-dup',
        start: '2026-05-10',
        executor: 'main',
        scope: 'test 1',
        exclusions: '',
        plannedTasks: [],
        completedAt: null,
        status: 'active',
      },
      {
        id: 'R-dup',
        start: '2026-05-11',
        executor: 'main',
        scope: 'test 2',
        exclusions: '',
        plannedTasks: [],
        completedAt: null,
        status: 'active',
      },
    ]
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'SCHEMA_INVALID' && e.message.includes('Duplicate round ID'))).toBe(true)
  })
})

describe('dependency-cycle.json fixture', () => {
  it('should pass lintDocument (structural only)', () => {
    const doc = loadFixture('dependency-cycle.json')
    const result = lintDocument(doc)
    expect(result.valid).toBe(true)
  })

  it('should fail validateDocument (cycle detected)', () => {
    const doc = loadFixture('dependency-cycle.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DEPENDENCY_CYCLE')).toBe(true)
  })
})

describe('feature reference validation', () => {
  it('should pass when task feature is null', () => {
    const doc = loadFixture('valid-tally.json')
    const result = lintDocument(doc)
    expect(result.valid).toBe(true)
  })

  it('should fail lintDocument when task feature not in _meta.features', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks[0].feature = 'nonexistent-feature'
    const result = lintDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('feature') && e.message.includes('not found'))).toBe(true)
  })

  it('should pass lintDocument when task feature exists in _meta.features', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const meta = doc._meta as Record<string, unknown>
    meta.features = [{ id: 'f1', module: 'core', name: 'Feature 1', status: 'stable', specRefs: [], dependsOn: [], owner: null }]
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks[0].feature = 'f1'
    const result = lintDocument(doc)
    expect(result.valid).toBe(true)
  })

  it('should detect feature-module mismatch in validateDocument', () => {
    const doc = loadFixture('valid-tally.json') as Record<string, unknown>
    const meta = doc._meta as Record<string, unknown>
    meta.features = [{ id: 'f1', module: 'other-module', name: 'Feature 1' }]
    const tasks = doc.tasks as Array<Record<string, unknown>>
    tasks[0].feature = 'f1'
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'FEATURE_MODULE_MISMATCH')).toBe(true)
  })
})
