import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { readLedger, ledgerPath } from '../src/ledger-reader'
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

  it('reads a valid .tally/tally.json', () => {
    mkdirSync(join(dir, '.tally'), { recursive: true })
    writeFileSync(join(dir, '.tally', 'tally.json'), JSON.stringify(validDoc, null, 2))
    const doc = readLedger(dir)
    expect(doc._meta.project).toBe('test')
  })

  it('throws on missing file', () => {
    expect(() => readLedger(dir)).toThrow(/not found/)
  })

  it('throws on invalid JSON', () => {
    mkdirSync(join(dir, '.tally'), { recursive: true })
    writeFileSync(join(dir, '.tally', 'tally.json'), 'not json')
    expect(() => readLedger(dir)).toThrow(/not valid JSON/)
  })

  it('ledgerPath returns the full path to the ledger file', () => {
    const path = ledgerPath(dir)
    expect(path).toBe(join(dir, '.tally', 'tally.json'))
  })

  it('reads full document with all v0.2.0 fields present', () => {
    const fullDoc: TallyDocument = {
      _meta: {
        project: 'full',
        tally_version: '0.2.0',
        created: '2026-05-15',
        updated: '2026-05-15',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['auth', 'core'] }],
        modules: [{ id: 'auth', name: 'Auth' }, { id: 'core', name: 'Core' }],
        features: [
          {
            id: 'feat-1',
            module: 'auth',
            name: 'Login',
            status: 'implementing',
            specRefs: ['spec/auth.md'],
            dependsOn: [],
            owner: 'main',
          },
        ],
      },
      tasks: [
        {
          id: 'T-001',
          status: 'pending',
          priority: 'P0',
          stage: 'S1',
          module: 'auth',
          name: 'Add login endpoint',
          acceptance: 'POST /login returns JWT',
          deps: [],
          blocks: null,
          nextAction: 'scaffold route',
          evidence: null,
          rule: null,
          aodsRefs: [],
          codeRefs: [],
          implementationTargets: [],
          feature: 'feat-1',
          tags: ['auth', 'api'],
          order: 1,
          completedOrder: null,
          claimedBy: null,
          claimedAt: null,
          createdAt: '2026-05-15',
          completedAt: null,
          writeScopes: ['src/auth/**'],
          acceptanceCriteria: {
            requiredTests: ['test_login_success', 'test_login_failure'],
            passConditions: ['JWT returned', 'status 200'],
            forbiddenSideEffects: ['no password in response'],
            negativeCases: ['invalid password → 401'],
          },
          executionPlan: {
            inputs: ['username', 'password'],
            outputs: ['JWT token'],
            steps: ['validate input', 'check credentials', 'sign JWT', 'return'],
          },
          riskLevel: 'high',
          rollbackPlan: 'revert to previous auth module',
          executionLane: 'contract',
          assignedAgent: 'main',
          requiresReview: true,
          resourceRequirements: ['db access', 'jwt secret'],
          repos: ['backend'],
          deliveryNode: null,
          approvedBy: 'reviewer',
        },
      ],
      rounds: [
        {
          id: 'R-2026-05-15-001',
          start: '2026-05-15',
          executor: 'main',
          scope: 'auth',
          exclusions: '',
          plannedTasks: [{ taskId: 'T-001', goal: 'Login endpoint', criteria: 'pass' }],
          completedAt: null,
          status: 'active',
        },
      ],
      blocks: [
        {
          id: 'B-001',
          affects: ['T-001'],
          content: 'Need JWT secret from ops',
          strategy: 'file request ticket',
          createdAt: '2026-05-15',
          resolvedAt: null,
        },
      ],
      progress: [
        {
          date: '2026-05-15',
          totalDone: 0,
          totalOpen: 1,
          totalHold: 0,
          totalBlocked: 1,
          evidence: 'initial snapshot',
          notes: '',
        },
      ],
    }

    mkdirSync(join(dir, '.tally'), { recursive: true })
    writeFileSync(join(dir, '.tally', 'tally.json'), JSON.stringify(fullDoc, null, 2))
    const doc = readLedger(dir)

    // Meta
    expect(doc._meta.project).toBe('full')
    expect(doc._meta.tally_version).toBe('0.2.0')
    expect(doc._meta.features).toHaveLength(1)
    expect(doc._meta.features[0].status).toBe('implementing')

    // Task with new v0.2.0 fields
    const task = doc.tasks[0]
    expect(task.writeScopes).toEqual(['src/auth/**'])
    expect(task.acceptanceCriteria).toEqual({
      requiredTests: ['test_login_success', 'test_login_failure'],
      passConditions: ['JWT returned', 'status 200'],
      forbiddenSideEffects: ['no password in response'],
      negativeCases: ['invalid password → 401'],
    })
    expect(task.executionPlan).toEqual({
      inputs: ['username', 'password'],
      outputs: ['JWT token'],
      steps: ['validate input', 'check credentials', 'sign JWT', 'return'],
    })
    expect(task.riskLevel).toBe('high')
    expect(task.rollbackPlan).toBe('revert to previous auth module')
    expect(task.executionLane).toBe('contract')
    expect(task.assignedAgent).toBe('main')
    expect(task.requiresReview).toBe(true)
    expect(task.resourceRequirements).toEqual(['db access', 'jwt secret'])
    expect(task.repos).toEqual(['backend'])
    expect(task.approvedBy).toBe('reviewer')

    // Round
    expect(doc.rounds).toHaveLength(1)
    expect(doc.rounds[0].plannedTasks[0].taskId).toBe('T-001')

    // Block
    expect(doc.blocks).toHaveLength(1)
    expect(doc.blocks[0].affects).toEqual(['T-001'])

    // Progress
    expect(doc.progress).toHaveLength(1)
    expect(doc.progress[0].totalBlocked).toBe(1)
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
