// cli/tests/task.test.ts
import { describe, it, expect } from 'vitest'
import type { TallyDocument } from '../src/types.js'
import {
  today,
  nextTaskId,
  nextOrder,
  nextCompletedOrder,
  addTasks,
  getTaskDetail,
  editTask,
  markTasksDone,
  blockTasks,
  unblockTasks,
  listTasks,
} from '../src/commands/task.js'

function validDoc(): TallyDocument {
  return {
    _meta: {
      project: 'test',
      tally_version: '1.0',
      created: '2026-05-10',
      updated: '2026-05-10',
      agents: [{ id: 'main', name: '主会话' }],
      stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
      modules: [{ id: 'core', name: 'Core Module' }],
    },
    tasks: [
      {
        id: 'U-001',
        status: 'pending',
        priority: 'P0',
        stage: 'S1',
        module: 'core',
        name: 'Task 1',
        acceptance: 'pass',
        deps: [],
        blocks: null,
        nextAction: 'do it',
        evidence: null,
        rule: null,
        tags: [],
        order: 1,
        completedOrder: null,
        claimedBy: null,
        claimedAt: null,
        createdAt: '2026-05-10',
        completedAt: null,
      },
      {
        id: 'U-002',
        status: 'pending',
        priority: 'P1',
        stage: 'S1',
        module: 'core',
        name: 'Task 2',
        acceptance: 'pass',
        deps: ['U-001'],
        blocks: null,
        nextAction: 'do it',
        evidence: null,
        rule: null,
        tags: [],
        order: 2,
        completedOrder: null,
        claimedBy: null,
        claimedAt: null,
        createdAt: '2026-05-10',
        completedAt: null,
      },
    ],
    rounds: [],
    blocks: [],
    progress: [],
  }
}

// ── Helper tests ──

describe('today', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = today()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('nextTaskId', () => {
  it('generates U-xxx by default', () => {
    const doc = validDoc()
    // highest is U-002 => next is U-003
    expect(nextTaskId(doc)).toBe('U-003')
  })

  it('generates D-xxx when prefix is D', () => {
    const doc = validDoc()
    // highest numeric is 2 => D-003
    expect(nextTaskId(doc, 'D')).toBe('D-003')
  })

  it('starts at 001 when no tasks exist', () => {
    const doc = validDoc()
    doc.tasks = []
    expect(nextTaskId(doc)).toBe('U-001')
  })

  it('pads with leading zeros', () => {
    const doc = validDoc()
    doc.tasks[0].id = 'U-009'
    doc.tasks[1].id = 'U-010'
    expect(nextTaskId(doc)).toBe('U-011')
  })
})

describe('nextOrder', () => {
  it('returns next available order among non-done tasks', () => {
    const doc = validDoc()
    expect(nextOrder(doc)).toBe(3) // orders 1, 2 exist
  })

  it('skips done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].order = null
    // only task 2 (order 2) is non-done
    expect(nextOrder(doc)).toBe(3)
  })

  it('returns 1 when no non-done tasks', () => {
    const doc = validDoc()
    doc.tasks = []
    expect(nextOrder(doc)).toBe(1)
  })
})

describe('nextCompletedOrder', () => {
  it('returns 1 when no done tasks', () => {
    const doc = validDoc()
    expect(nextCompletedOrder(doc)).toBe(1)
  })

  it('returns next after highest completedOrder', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedOrder = 5
    expect(nextCompletedOrder(doc)).toBe(6)
  })
})

// ── addTasks ──

describe('addTasks', () => {
  it('creates tasks with sequential U-xxx IDs', () => {
    const doc = validDoc()
    const created = addTasks(doc, [
      { name: 'New Task A', stage: 'S1', module: 'core' },
      { name: 'New Task B', stage: 'S1', module: 'core' },
    ])
    expect(created).toHaveLength(2)
    expect(created[0].id).toBe('U-003')
    expect(created[1].id).toBe('U-004')
  })

  it('sets default fields', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{ name: 'Default Test', stage: 'S1', module: 'core' }])
    expect(task.status).toBe('pending')
    expect(task.priority).toBe('P1')
    expect(task.deps).toEqual([])
    expect(task.tags).toEqual([])
    expect(task.evidence).toBeNull()
    expect(task.rule).toBeNull()
    expect(task.blocks).toBeNull()
    expect(task.nextAction).toBeNull()
    expect(task.completedAt).toBeNull()
    expect(task.claimedBy).toBeNull()
    expect(task.claimedAt).toBeNull()
    expect(task.createdAt).toBe(today())
    expect(task.order).toBe(3) // after 1 and 2
  })

  it('accepts optional fields', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{
      name: 'Custom',
      stage: 'S1',
      module: 'core',
      priority: 'P0',
      acceptance: 'must work',
      deps: ['U-001'],
      tags: ['bug', 'urgent'],
    }])
    expect(task.priority).toBe('P0')
    expect(task.acceptance).toBe('must work')
    expect(task.deps).toEqual(['U-001'])
    expect(task.tags).toEqual(['bug', 'urgent'])
  })

  it('rejects invalid stage reference', () => {
    const doc = validDoc()
    expect(() => addTasks(doc, [{ name: 'Bad', stage: 'BOGUS', module: 'core' }]))
      .toThrow(/Stage "BOGUS" not found/)
  })

  it('rejects invalid module reference', () => {
    const doc = validDoc()
    expect(() => addTasks(doc, [{ name: 'Bad', stage: 'S1', module: 'BOGUS' }]))
      .toThrow(/Module "BOGUS" not found/)
  })
})

// ── getTaskDetail + show ──

describe('getTaskDetail', () => {
  it('returns task with ancestors and descendants', () => {
    const doc = validDoc()
    // U-002 depends on U-001
    const detail = getTaskDetail(doc, 'U-002')
    expect(detail.task.id).toBe('U-002')
    expect(detail.ancestors.map((a) => a.id)).toEqual(['U-001'])
    expect(detail.descendants).toHaveLength(0)
  })

  it('returns ancestors for the root task as empty', () => {
    const doc = validDoc()
    const detail = getTaskDetail(doc, 'U-001')
    expect(detail.ancestors).toHaveLength(0)
    expect(detail.descendants.map((d) => d.id)).toEqual(['U-002'])
  })

  it('throws for missing task', () => {
    const doc = validDoc()
    expect(() => getTaskDetail(doc, 'U-999')).toThrow(/not found/)
  })

  it('handles deep dependency chains', () => {
    const doc = validDoc()
    // Add U-003 that depends on U-002
    doc.tasks.push({
      id: 'U-003', status: 'pending', priority: 'P1', stage: 'S1', module: 'core',
      name: 'Task 3', acceptance: 'pass', deps: ['U-002'], blocks: null,
      nextAction: null, evidence: null, rule: null, tags: [],
      order: 3, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
    })
    const detail = getTaskDetail(doc, 'U-003')
    expect(detail.ancestors.map((a) => a.id).sort()).toEqual(['U-001', 'U-002'])
    expect(detail.descendants).toHaveLength(0)
  })

  it('handles circular dependencies safely', () => {
    const doc = validDoc()
    // Create a cycle: U-001 depends on U-002 (U-002 already depends on U-001)
    doc.tasks[0].deps = ['U-002']
    // Should not infinite loop — the visited set prevents it.
    // In a cycle the ancestor chain includes both tasks (U-001→U-002→U-001 hits visited).
    // The descendant chain finds U-002 depends on U-001, then U-001 is already visited.
    const detail = getTaskDetail(doc, 'U-001')
    expect(detail.ancestors.map((a) => a.id).sort()).toEqual(['U-001', 'U-002'])
    expect(detail.descendants.map((d) => d.id)).toEqual(['U-002'])
  })
})

// ── editTask ──

describe('editTask', () => {
  it('modifies name', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { name: 'Updated Name' })
    expect(task.name).toBe('Updated Name')
  })

  it('modifies priority', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { priority: 'P0' })
    expect(task.priority).toBe('P0')
  })

  it('rejects invalid priority', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { priority: 'P99' }))
      .toThrow(/Invalid priority/)
  })

  it('modifies stage with validation', () => {
    const doc = validDoc()
    // Add a second stage
    doc._meta.stages.push({ id: 'S2', name: 'Stage 2', modules: ['core'] })
    const task = editTask(doc, 'U-001', { stage: 'S2' })
    expect(task.stage).toBe('S2')
  })

  it('rejects invalid stage', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { stage: 'BOGUS' }))
      .toThrow(/Stage "BOGUS" not found/)
  })

  it('modifies module with validation', () => {
    const doc = validDoc()
    doc._meta.modules.push({ id: 'ui', name: 'UI Module' })
    const task = editTask(doc, 'U-001', { module: 'ui' })
    expect(task.module).toBe('ui')
  })

  it('rejects invalid module', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { module: 'BOGUS' }))
      .toThrow(/Module "BOGUS" not found/)
  })

  it('modifies acceptance', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { acceptance: 'new criteria' })
    expect(task.acceptance).toBe('new criteria')
  })

  it('modifies deps', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { deps: ['U-002'] })
    expect(task.deps).toEqual(['U-002'])
  })

  it('modifies nextAction', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { nextAction: 'next thing' })
    expect(task.nextAction).toBe('next thing')
  })

  it('modifies tags', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { tags: ['a', 'b'] })
    expect(task.tags).toEqual(['a', 'b'])
  })

  it('refuses to edit done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    expect(() => editTask(doc, 'U-001', { name: 'Nope' }))
      .toThrow(/already done/)
  })

  it('throws for missing task', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-999', { name: 'Nope' }))
      .toThrow(/not found/)
  })
})

// ── markTasksDone ──

describe('markTasksDone', () => {
  it('marks a single task done with evidence', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'all tests pass')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('done')
    expect(results[0].evidence).toBe('all tests pass')
    expect(results[0].completedAt).toBe(today())
    expect(results[0].order).toBeNull()
    expect(results[0].nextAction).toBeNull()
    expect(results[0].blocks).toBeNull()
  })

  it('rewrites U-xxx to D-xxx', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'done')
    // The ID in the array is already rewritten
    const task = doc.tasks.find((t) => t.completedOrder !== null)
    expect(task?.id).toBe('D-001')
  })

  it('sets completedOrder sequentially', () => {
    const doc = validDoc()
    markTasksDone(doc, ['U-001'], 'first')
    markTasksDone(doc, ['U-002'], 'second')
    const done = doc.tasks.filter((t) => t.status === 'done')
    expect(done.map((t) => t.completedOrder).sort()).toEqual([1, 2])
  })

  it('updates dependency references in other tasks', () => {
    const doc = validDoc()
    // U-002 depends on U-001
    markTasksDone(doc, ['U-001'], 'done')
    const task2 = doc.tasks.find((t) => t.name === 'Task 2')
    expect(task2?.deps).toEqual(['D-001'])
  })

  it('updates references in rounds plannedTasks', () => {
    const doc = validDoc()
    doc.rounds.push({
      id: 'R1', start: '2026-05-10', executor: 'main',
      scope: 'test', exclusions: '',
      plannedTasks: [{ taskId: 'U-001', goal: 'test', criteria: 'pass' }],
      completedAt: null, status: 'active',
    })
    markTasksDone(doc, ['U-001'], 'done')
    expect(doc.rounds[0].plannedTasks[0].taskId).toBe('D-001')
  })

  it('updates references in blocks affects', () => {
    const doc = validDoc()
    doc.blocks.push({
      id: 'B1', affects: ['U-001'], content: 'blocked by bug',
      strategy: 'fix', createdAt: '2026-05-10', resolvedAt: null,
    })
    markTasksDone(doc, ['U-001'], 'done')
    expect(doc.blocks[0].affects).toEqual(['D-001'])
  })

  it('supports --rule flag', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'evidence text', 'verified-by-rule')
    expect(results[0].rule).toBe('verified-by-rule')
  })

  it('refuses to mark already done task', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    expect(() => markTasksDone(doc, ['U-001'], 'evidence'))
      .toThrow(/already done/)
  })

  it('throws for missing task', () => {
    const doc = validDoc()
    expect(() => markTasksDone(doc, ['U-999'], 'evidence'))
      .toThrow(/not found/)
  })
})

// ── blockTasks ──

describe('blockTasks', () => {
  it('blocks a task with reason', () => {
    const doc = validDoc()
    const results = blockTasks(doc, ['U-001'], 'waiting on external API')
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('blocked')
    expect(results[0].blocks).toBe('waiting on external API')
  })

  it('blocks multiple tasks at once', () => {
    const doc = validDoc()
    const results = blockTasks(doc, ['U-001', 'U-002'], 'all blocked')
    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('blocked')
    expect(results[1].status).toBe('blocked')
  })

  it('refuses to block done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    expect(() => blockTasks(doc, ['U-001'], 'reason'))
      .toThrow(/already done/)
  })

  it('throws for missing task', () => {
    const doc = validDoc()
    expect(() => blockTasks(doc, ['U-999'], 'reason'))
      .toThrow(/not found/)
  })
})

// ── unblockTasks ──

describe('unblockTasks', () => {
  it('unblocks a blocked task', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'blocked'
    doc.tasks[0].blocks = 'was stuck'
    const results = unblockTasks(doc, ['U-001'])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('pending')
    expect(results[0].blocks).toBeNull()
  })

  it('refuses to unblock non-blocked task', () => {
    const doc = validDoc()
    // U-001 is pending
    expect(() => unblockTasks(doc, ['U-001']))
      .toThrow(/not blocked/)
  })

  it('refuses to unblock done task', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    expect(() => unblockTasks(doc, ['U-001']))
      .toThrow(/not blocked/)
  })

  it('throws for missing task', () => {
    const doc = validDoc()
    expect(() => unblockTasks(doc, ['U-999']))
      .toThrow(/not found/)
  })
})

// ── listTasks ──

describe('listTasks', () => {
  it('returns all tasks with no filters', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, {})
    expect(tasks).toHaveLength(2)
  })

  it('filters by status', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    const tasks = listTasks(doc, { status: 'pending' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('filters by module', () => {
    const doc = validDoc()
    doc._meta.modules.push({ id: 'ui', name: 'UI' })
    doc.tasks[0].module = 'ui'
    const tasks = listTasks(doc, { module: 'core' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('filters by stage', () => {
    const doc = validDoc()
    doc._meta.stages.push({ id: 'S2', name: 'Stage 2', modules: ['core'] })
    doc.tasks[0].stage = 'S2'
    const tasks = listTasks(doc, { stage: 'S1' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('filters by priority', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { priority: 'P0' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
  })

  it('filters by tag', () => {
    const doc = validDoc()
    doc.tasks[0].tags = ['bug']
    doc.tasks[1].tags = ['feature']
    const tasks = listTasks(doc, { tag: 'bug' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
  })

  it('filters by search (name match)', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'Task 1' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
  })

  it('filters by search (id match)', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'U-002' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('filters by search (case insensitive)', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'task 2' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('combines multiple filters', () => {
    const doc = validDoc()
    doc.tasks.push({
      id: 'U-003', status: 'pending', priority: 'P1', stage: 'S1', module: 'core',
      name: 'Task 3', acceptance: 'pass', deps: [], blocks: null,
      nextAction: null, evidence: null, rule: null, tags: ['bug'],
      order: 3, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
    })
    const tasks = listTasks(doc, { status: 'pending', priority: 'P1', tag: 'bug' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-003')
  })

  it('returns empty array when no matches', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'nonexistent' })
    expect(tasks).toHaveLength(0)
  })
})
