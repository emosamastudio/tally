// cli/tests/round.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { startRound, closeRound, generateRoundReport, generateRoundId, formatRoundStart } from '../src/commands/round.js'
import type { StartRoundResult } from '../src/commands/round.js'
import { readLedger } from '../src/ledger-reader.js'
import { writeLedger } from '../src/ledger-writer.js'
import type { TallyDocument } from '../src/types.js'

function testDoc(): TallyDocument {
  return {
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
    tasks: [
      makeTask('U-001', 'pending', [], 1),
      makeTask('U-002', 'pending', ['U-001'], 2),
      makeTask('U-003', 'pending', [], 3),
      makeTask('U-004', 'blocked', [], 4, 'stuck'),
      makeTask('U-005', 'hold', [], 5),
    ],
    rounds: [],
    blocks: [],
    progress: [],
  }
}

function makeTask(
  id: string,
  status: string,
  deps: string[],
  order: number,
  blocks?: string,
  module?: string,
  feature?: string,
  writeScopes?: string[],
) {
  return {
    id,
    status,
    priority: 'P1' as const,
    stage: 'S1',
    module: module ?? 'core',
    name: `Task ${id}`,
    acceptance: 'pass',
    deps,
    blocks: blocks ?? null,
    nextAction: 'do it',
    evidence: null,
    rule: null,
    feature: feature ?? null,
    tags: [],
    order,
    completedOrder: null,
    claimedBy: null,
    claimedAt: null,
    createdAt: '2026-05-10',
    completedAt: null,
    writeScopes: writeScopes ?? [],
    acceptanceCriteria: null,
    executionPlan: null,
    riskLevel: 'medium',
    rollbackPlan: null,
    executionLane: null,
    assignedAgent: null,
    requiresReview: false,
    resourceRequirements: [],
    repos: [],
    deliveryNode: null,
    approvedBy: null,
  }
}

// ── round start ──

describe('round start', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync('/tmp/tally-round-')
    writeLedger(testDoc(), dir)
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('auto-selects pending tasks with satisfied deps, skips blocked/hold', () => {
    const result = startRound('test scope', { cwd: dir, agentId: 'main' })
    expect(result.selected.length).toBeGreaterThan(0)
    // U-002 should NOT be selected (depends on U-001 which is pending, not done)
    // U-004 should NOT be selected (blocked)
    // U-005 should NOT be selected (hold)
    const selectedIds = result.selected.map((s) => s.taskId)
    expect(selectedIds).toContain('U-001')
    expect(selectedIds).toContain('U-003')
    expect(selectedIds).not.toContain('U-002') // dep not satisfied
    expect(selectedIds).not.toContain('U-004') // blocked
    expect(selectedIds).not.toContain('U-005') // hold
  })

  it('refuses tasks claimed by another active round', () => {
    // First round claims U-001
    startRound('first', { cwd: dir, agentId: 'main', taskIds: ['U-001'] })
    // Second agent tries to claim U-001
    expect(() =>
      startRound('second', { cwd: dir, agentId: 'app-dev', taskIds: ['U-001'] }),
    ).toThrow(/claimed/)
  })

  it('rejects if no active round allowed and agent already has one', () => {
    startRound('first', { cwd: dir, agentId: 'main' })
    expect(() => startRound('second', { cwd: dir, agentId: 'main' })).toThrow(
      /active round/,
    )
  })

  it('accepts explicitly specified task IDs', () => {
    const result = startRound('explicit', {
      cwd: dir,
      agentId: 'main',
      taskIds: ['U-001'],
    })
    expect(result.selected).toHaveLength(1)
    expect(result.selected[0].taskId).toBe('U-001')
    expect(result.roundId).toMatch(/^R-\d{4}-\d{2}-\d{2}-\d{3}$/)
  })

  it('sets claimedBy and claimedAt on selected tasks', () => {
    const { roundId } = startRound('test', {
      cwd: dir,
      agentId: 'main',
      taskIds: ['U-001'],
    })
    const doc = readLedger(dir)
    const task = doc.tasks.find((t) => t.id === 'U-001')!
    expect(task.claimedBy).toBe(roundId)
    expect(task.claimedAt).toBeTruthy()
  })

  it('rejects tasks with unsatisfied dependencies', () => {
    // U-002 depends on U-001 which is pending (not done)
    expect(() =>
      startRound('bad deps', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-002'],
      }),
    ).toThrow(/unsatisfied dependencies/)
  })

  it('rejects non-existent task IDs', () => {
    expect(() =>
      startRound('bad id', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-999'],
      }),
    ).toThrow(/not found/)
  })

  it('rejects blocked/hold tasks even when explicitly specified', () => {
    expect(() =>
      startRound('blocked', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-004'],
      }),
    ).toThrow(/status/)
  })

  it('atomically rejects all tasks if any conflict', () => {
    // First round claims U-001
    startRound('first', { cwd: dir, agentId: 'main', taskIds: ['U-001'] })

    // Second agent tries to claim U-001 and U-003 together
    expect(() =>
      startRound('second', {
        cwd: dir,
        agentId: 'app-dev',
        taskIds: ['U-001', 'U-003'],
      }),
    ).toThrow(/cannot start round/i)

    // Verify U-003 was NOT claimed (atomic rollback)
    const doc = readLedger(dir)
    const u3 = doc.tasks.find((t) => t.id === 'U-003')!
    expect(u3.claimedBy).toBeNull()
  })

  it('groups auto-selected tasks by module then feature within same depth', () => {
    // Create tasks at depth 0 with mixed modules and features.
    // Expected sort order: module alpha → feature alpha → order asc
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['auth', 'core'] }],
        modules: [{ id: 'auth', name: 'Auth' }, { id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        // module=core, feature=f2
        makeTask('U-001', 'pending', [], 1, undefined, 'core', 'f2'),
        // module=core, feature=f1 (same module, earlier feature → should come before U-001)
        makeTask('U-002', 'pending', [], 2, undefined, 'core', 'f1'),
        // module=auth, feature=f2
        makeTask('U-003', 'pending', [], 3, undefined, 'auth', 'f2'),
        // module=auth, feature=f1 (earliest module, earliest feature → should come first)
        makeTask('U-004', 'pending', [], 4, undefined, 'auth', 'f1'),
        // module=core, no feature (null sorts before non-null in localeCompare)
        makeTask('U-005', 'pending', [], 5, undefined, 'core'),
      ],
      rounds: [], blocks: [], progress: [],
    }
    const dir2 = mkdtempSync('/tmp/tally-round-feature-')
    try {
      writeLedger(doc, dir2)
      const result = startRound('feature-sort', { cwd: dir2, agentId: 'main' })
      const ids = result.selected.map((s) => s.taskId)
      // auth sorts before core; within auth: f1 before f2; within core: null before f1 before f2
      expect(ids).toEqual(['U-004', 'U-003', 'U-005', 'U-002', 'U-001'])
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('rejects tasks with overlapping writeScopes', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1, undefined, 'core', undefined, ['src/auth/**']),
        makeTask('U-002', 'pending', [], 2, undefined, 'core', undefined, ['src/auth/**']),
      ],
      rounds: [], blocks: [], progress: [],
    }
    const dir2 = mkdtempSync('/tmp/tally-round-ws-')
    try {
      writeLedger(doc, dir2)
      expect(() => startRound('ws-conflict', { cwd: dir2, agentId: 'main' }))
        .toThrow(/write scope/)
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('rejects tasks with risk above maxRisk gate', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1),
      ],
      rounds: [], blocks: [], progress: [],
    }
    doc.tasks[0].riskLevel = 'critical'
    const dir2 = mkdtempSync('/tmp/tally-round-risk-')
    try {
      writeLedger(doc, dir2)
      expect(() => startRound('risk-gate', { cwd: dir2, agentId: 'main' }))
        .toThrow(/risk level.*exceeding/)
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('rejects unapproved high-risk tasks (approval gate)', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1),
      ],
      rounds: [], blocks: [], progress: [],
    }
    doc.tasks[0].riskLevel = 'high'
    const dir2 = mkdtempSync('/tmp/tally-round-approve-')
    try {
      writeLedger(doc, dir2)
      expect(() => startRound('approve-gate', { cwd: dir2, agentId: 'main' }))
        .toThrow(/not approved/)
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('allows approved high-risk tasks', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1),
      ],
      rounds: [], blocks: [], progress: [],
    }
    doc.tasks[0].riskLevel = 'high'
    doc.tasks[0].approvedBy = 'human-reviewer'
    const dir2 = mkdtempSync('/tmp/tally-round-approved-')
    try {
      writeLedger(doc, dir2)
      const result = startRound('approved-task', { cwd: dir2, agentId: 'main' })
      expect(result.selected.length).toBe(1)
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('uses feature-focused strategy', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1, undefined, 'core', 'f-b'),
        makeTask('U-002', 'pending', [], 2, undefined, 'core', 'f-a'),
        makeTask('U-003', 'pending', [], 3, undefined, 'core', 'f-a'),
      ],
      rounds: [], blocks: [], progress: [],
    }
    const dir2 = mkdtempSync('/tmp/tally-round-strat-')
    try {
      writeLedger(doc, dir2)
      const result = startRound('feature-strat', { cwd: dir2, agentId: 'main', strategy: 'feature-focused' })
      const ids = result.selected.map((s) => s.taskId)
      // f-a tasks should come before f-b tasks
      expect(ids[0]).toBe('U-002')
      expect(ids[1]).toBe('U-003')
      expect(ids[2]).toBe('U-001')
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('uses risk-first strategy', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1),
        makeTask('U-002', 'pending', [], 2),
        makeTask('U-003', 'pending', [], 3),
      ],
      rounds: [], blocks: [], progress: [],
    }
    doc.tasks[0].riskLevel = 'medium'
    doc.tasks[1].riskLevel = 'high'
    doc.tasks[2].riskLevel = 'low'
    // High risk must be approved to pass approval gate
    doc.tasks[1].approvedBy = 'reviewer'
    const dir2 = mkdtempSync('/tmp/tally-round-riskfirst-')
    try {
      writeLedger(doc, dir2)
      const result = startRound('risk-strat', { cwd: dir2, agentId: 'main', strategy: 'risk-first' })
      const ids = result.selected.map((s) => s.taskId)
      // high first, then medium, then low
      expect(ids[0]).toBe('U-002')
      expect(ids[1]).toBe('U-001')
      expect(ids[2]).toBe('U-003')
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('returns lane distribution warning', () => {
    const doc: TallyDocument = {
      _meta: {
        project: 'test', tally_version: '1.0', created: '2026-05-10', updated: '2026-05-10',
        agents: [{ id: 'main', name: '主会话' }],
        stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [],
      },
      tasks: [
        makeTask('U-001', 'pending', [], 1),
        makeTask('U-002', 'pending', [], 2),
      ],
      rounds: [], blocks: [], progress: [],
    }
    doc.tasks[0].executionLane = 'writer'
    doc.tasks[1].executionLane = 'test'
    const dir2 = mkdtempSync('/tmp/tally-round-lane-')
    try {
      writeLedger(doc, dir2)
      const result = startRound('lane-warn', { cwd: dir2, agentId: 'main' })
      expect(result.warnings.some((w) => w.includes('Lane distribution'))).toBe(true)
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })
})

// ── generateRoundReport ──

describe('generateRoundReport', () => {
  it('reports tasks and counts for a round', () => {
    const doc = testDoc()
    // Create a completed round manually
    doc.rounds.push({
      id: 'R-2026-05-10-001',
      start: '2026-05-10',
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [
        { taskId: 'U-001', goal: 'Task U-001', criteria: 'pass' },
        { taskId: 'U-002', goal: 'Task U-002', criteria: 'pass' },
      ],
      completedAt: null,
      status: 'active',
    })
    // Mark U-001 as done
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedAt = '2026-05-10'

    const report = generateRoundReport(doc, 'R-2026-05-10-001')
    expect(report.roundId).toBe('R-2026-05-10-001')
    expect(report.totalCount).toBe(2)
    expect(report.doneCount).toBe(1)
    expect(report.tasks[0].status).toBe('done')
    expect(report.tasks[1].status).toBe('pending')
    expect(report.remaining).toEqual(['U-002'])
  })

  it('throws when round not found', () => {
    const doc = testDoc()
    expect(() => generateRoundReport(doc, 'R-nonexistent')).toThrow(
      /not found/,
    )
  })

  it('throws when no rounds exist', () => {
    const doc = testDoc()
    expect(() => generateRoundReport(doc)).toThrow(/no round found/i)
  })

  it('finds task by D-xxx prefix when task ID was rewritten', () => {
    const doc = testDoc()
    doc.rounds.push({
      id: 'R-2026-05-10-001',
      start: '2026-05-10',
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [
        { taskId: 'U-001', goal: 'Task U-001', criteria: 'pass' },
      ],
      completedAt: null,
      status: 'active',
    })
    // Rewrite U-001 to D-001
    doc.tasks[0].id = 'D-001'
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedAt = '2026-05-10'

    const report = generateRoundReport(doc, 'R-2026-05-10-001')
    expect(report.tasks[0].status).toBe('done')
  })
})

// ── round close ──

describe('round close', () => {
  it('releases done tasks, reverts unfinished, appends progress', () => {
    const dir = mkdtempSync('/tmp/tally-close-')
    try {
      writeLedger(testDoc(), dir)

      // Start round
      const { roundId } = startRound('test', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-001', 'U-003'],
      })

      // Mark U-001 done (simulates task done command)
      const doc = readLedger(dir)
      const t1 = doc.tasks.find((t) => t.id === 'U-001')!
      t1.status = 'done'
      t1.evidence = 'completed'
      t1.completedAt = '2026-05-10'
      t1.id = 'D-001'
      writeLedger(doc, dir)

      // Close round
      const result = closeRound({ cwd: dir, agentId: 'main' })

      expect(result.done).toBe(1)
      expect(result.reverted).toBe(1) // U-003 not done → reverted

      // Verify
      const final = readLedger(dir)
      expect(final.rounds[0].status).toBe('completed')
      expect(final.progress.length).toBe(1)

      // U-003 should be released
      const u3 = final.tasks.find((t) => t.id === 'U-003')!
      expect(u3.claimedBy).toBeNull()
      expect(u3.status).toBe('pending')

      // D-001 should be released
      const d1 = final.tasks.find((t) => t.id === 'D-001')!
      expect(d1.claimedBy).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('throws when no active round exists', () => {
    const dir = mkdtempSync('/tmp/tally-close-none-')
    try {
      writeLedger(testDoc(), dir)
      expect(() => closeRound({ cwd: dir, agentId: 'main' })).toThrow(
        /no active round/i,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('closes by explicit round ID', () => {
    const dir = mkdtempSync('/tmp/tally-close-byid-')
    try {
      writeLedger(testDoc(), dir)

      const { roundId } = startRound('test', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-001'],
      })

      const result = closeRound({ cwd: dir, roundId })
      expect(result.roundId).toBe(roundId)
      expect(result.done).toBe(0)
      expect(result.reverted).toBe(1)

      const final = readLedger(dir)
      expect(final.rounds[0].status).toBe('completed')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('appends a ProgressPoint with correct counts', () => {
    const dir = mkdtempSync('/tmp/tally-close-progress-')
    try {
      writeLedger(testDoc(), dir)

      startRound('test', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-001'],
      })

      closeRound({ cwd: dir, agentId: 'main' })

      const final = readLedger(dir)
      expect(final.progress.length).toBe(1)
      const pp = final.progress[0]
      expect(pp.totalDone).toBe(0) // U-001 was reverted, no tasks done
      expect(pp.totalOpen).toBeGreaterThanOrEqual(2) // U-001, U-003 are pending
      expect(pp.totalHold).toBe(1) // U-005
      expect(pp.totalBlocked).toBe(1) // U-004
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── generateRoundId ──

describe('generateRoundId', () => {
  it('returns R-YYYY-MM-DD-001 when no rounds exist', () => {
    const doc = testDoc()
    doc.rounds = []
    const id = generateRoundId(doc)
    expect(id).toMatch(/^R-\d{4}-\d{2}-\d{2}-001$/)
  })

  it('increments sequence number from existing same-day rounds', () => {
    const doc = testDoc()
    const dateStr = new Date().toISOString().slice(0, 10)
    doc.rounds.push({
      id: `R-${dateStr}-001`,
      start: dateStr,
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [],
      completedAt: null,
      status: 'completed',
    })
    doc.rounds.push({
      id: `R-${dateStr}-002`,
      start: dateStr,
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [],
      completedAt: null,
      status: 'completed',
    })
    const id = generateRoundId(doc)
    expect(id).toBe(`R-${dateStr}-003`)
  })

  it('ignores rounds from other dates when computing sequence', () => {
    const doc = testDoc()
    const dateStr = new Date().toISOString().slice(0, 10)
    doc.rounds.push({
      id: 'R-2020-01-01-005',
      start: '2020-01-01',
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [],
      completedAt: null,
      status: 'completed',
    })
    const id = generateRoundId(doc)
    expect(id).toBe(`R-${dateStr}-001`)
  })
})

// ── formatRoundStart ──

describe('formatRoundStart', () => {
  it('includes round ID, task count, and warnings when present', () => {
    const result: StartRoundResult = {
      roundId: 'R-2026-05-15-001',
      selected: [
        { taskId: 'U-001', goal: 'Task One', criteria: 'pass' },
        { taskId: 'U-002', goal: 'Task Two', criteria: 'pass' },
      ],
      warnings: ['Lane distribution: writer=1, test=1'],
    }
    const output = formatRoundStart(result)
    expect(output).toContain('Round started: R-2026-05-15-001')
    expect(output).toContain('Tasks claimed: 2')
    expect(output).toContain('Warnings:')
    expect(output).toContain('Lane distribution')
    expect(output).toContain('U-001  Task One')
    expect(output).toContain('U-002  Task Two')
  })

  it('omits warnings section when none present', () => {
    const result: StartRoundResult = {
      roundId: 'R-2026-05-15-001',
      selected: [{ taskId: 'U-001', goal: 'Task One', criteria: 'pass' }],
      warnings: [],
    }
    const output = formatRoundStart(result)
    expect(output).toContain('Round started: R-2026-05-15-001')
    expect(output).toContain('Tasks claimed: 1')
    expect(output).not.toContain('Warnings')
  })
})

// ── closeRound: already completed edge case ──

describe('closeRound already completed', () => {
  it('throws when round is already completed', () => {
    const dir = mkdtempSync('/tmp/tally-close-complete-')
    try {
      writeLedger(testDoc(), dir)

      const { roundId } = startRound('test', {
        cwd: dir,
        agentId: 'main',
        taskIds: ['U-001'],
      })

      // Close it once
      closeRound({ cwd: dir, agentId: 'main' })

      // Attempt to close the same round again — should throw
      expect(() => closeRound({ cwd: dir, roundId })).toThrow(/already completed/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('throws when no rounds exist at all', () => {
    const dir = mkdtempSync('/tmp/tally-close-zero-')
    try {
      writeLedger(testDoc(), dir)
      // testDoc() produces rounds: [] — the ledger has tasks but zero rounds
      expect(() => closeRound({ cwd: dir, agentId: 'main' })).toThrow(/no active round/i)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── generateRoundReport: mixed statuses ──

describe('generateRoundReport mixed statuses', () => {
  it('reports done, pending, blocked, and hold tasks with correct counts', () => {
    const doc = testDoc()
    doc.rounds.push({
      id: 'R-2026-05-15-001',
      start: '2026-05-15',
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [
        { taskId: 'U-001', goal: 'Task U-001', criteria: 'pass' },
        { taskId: 'U-003', goal: 'Task U-003', criteria: 'pass' },
        { taskId: 'U-004', goal: 'Task U-004', criteria: 'pass' },
        { taskId: 'U-005', goal: 'Task U-005', criteria: 'pass' },
      ],
      completedAt: null,
      status: 'active',
    })
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedAt = '2026-05-15'
    // U-003 stays pending (index 2)
    // U-004 stays blocked (index 3)
    // U-005 stays hold (index 4)

    const report = generateRoundReport(doc, 'R-2026-05-15-001')
    expect(report.doneCount).toBe(1)
    expect(report.totalCount).toBe(4)
    expect(report.tasks[0].status).toBe('done')
    expect(report.tasks[1].status).toBe('pending')
    expect(report.tasks[2].status).toBe('blocked')
    expect(report.tasks[3].status).toBe('hold')
    expect(report.remaining).toEqual(['U-003', 'U-004', 'U-005'])
  })

  it('finds task by D-xxx prefix when id was rewritten after completion', () => {
    const doc = testDoc()
    doc.rounds.push({
      id: 'R-2026-05-15-002',
      start: '2026-05-15',
      executor: 'main',
      scope: 'test',
      exclusions: '',
      plannedTasks: [
        { taskId: 'U-001', goal: 'Task U-001', criteria: 'pass' },
      ],
      completedAt: null,
      status: 'active',
    })
    // Simulate task done → id rewritten from U-001 to D-001
    doc.tasks[0].id = 'D-001'
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedAt = '2026-05-15'

    const report = generateRoundReport(doc, 'R-2026-05-15-002')
    expect(report.tasks[0].taskId).toBe('U-001')
    expect(report.tasks[0].status).toBe('done')
    expect(report.doneCount).toBe(1)
    expect(report.remaining).toEqual([])
  })
})
