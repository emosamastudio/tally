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
  formatTaskTable,
  formatTaskDetail,
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
      features: [],
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
        aodsRefs: [],
        codeRefs: [],
        implementationTargets: [],
        feature: null,
        tags: [],
        order: 1,
        completedOrder: null,
        claimedBy: null,
        claimedAt: null,
        createdAt: '2026-05-10',
        completedAt: null,
        writeScopes: [],
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
        aodsRefs: [],
        codeRefs: [],
        implementationTargets: [],
        feature: null,
        tags: [],
        order: 2,
        completedOrder: null,
        claimedBy: null,
        claimedAt: null,
        createdAt: '2026-05-10',
        completedAt: null,
        writeScopes: [],
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

  it('accepts feature field', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{
      name: 'Feature Task',
      stage: 'S1',
      module: 'core',
      feature: 'f-login',
    }])
    expect(task.feature).toBe('f-login')
  })

  it('defaults new scheduling fields', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{ name: 'Defaults', stage: 'S1', module: 'core' }])
    expect(task.writeScopes).toEqual([])
    expect(task.acceptanceCriteria).toBeNull()
    expect(task.executionPlan).toBeNull()
    expect(task.riskLevel).toBe('medium')
    expect(task.rollbackPlan).toBeNull()
    expect(task.executionLane).toBeNull()
    expect(task.assignedAgent).toBeNull()
    expect(task.requiresReview).toBe(false)
    expect(task.resourceRequirements).toEqual([])
    expect(task.repos).toEqual([])
    expect(task.deliveryNode).toBeNull()
    expect(task.approvedBy).toBeNull()
  })

  it('accepts scheduling fields', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{
      name: 'Scheduled',
      stage: 'S1',
      module: 'core',
      writeScopes: ['src/auth/**'],
      riskLevel: 'high',
      executionLane: 'writer',
      rollbackPlan: 'git revert',
      requiresReview: true,
      resourceRequirements: ['openai/gpt-4o'],
      repos: ['polaris-impl'],
      deliveryNode: 'D6',
    }])
    expect(task.writeScopes).toEqual(['src/auth/**'])
    expect(task.riskLevel).toBe('high')
    expect(task.executionLane).toBe('writer')
    expect(task.rollbackPlan).toBe('git revert')
    expect(task.requiresReview).toBe(true)
    expect(task.resourceRequirements).toEqual(['openai/gpt-4o'])
    expect(task.repos).toEqual(['polaris-impl'])
    expect(task.deliveryNode).toBe('D6')
  })

  it('defaults feature to null when not specified', () => {
    const doc = validDoc()
    const [task] = addTasks(doc, [{ name: 'No Feature', stage: 'S1', module: 'core' }])
    expect(task.feature).toBeNull()
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

  it('rejects module outside the selected stage', () => {
    const doc = validDoc()
    doc._meta.modules.push({ id: 'ui', name: 'UI Module' })
    expect(() => addTasks(doc, [{ name: 'Bad', stage: 'S1', module: 'ui' }]))
      .toThrow(/Stage "S1" does not include module "ui"/)
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
      nextAction: null, evidence: null, rule: null, aodsRefs: [], codeRefs: [], implementationTargets: [], tags: [],
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
    doc._meta.stages[0].modules.push('ui')
    const task = editTask(doc, 'U-001', { module: 'ui' })
    expect(task.module).toBe('ui')
  })

  it('rejects invalid module', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { module: 'BOGUS' }))
      .toThrow(/Module "BOGUS" not found/)
  })

  it('rejects edited module outside the selected stage', () => {
    const doc = validDoc()
    doc._meta.modules.push({ id: 'ui', name: 'UI Module' })
    expect(() => editTask(doc, 'U-001', { module: 'ui' }))
      .toThrow(/Stage "S1" does not include module "ui"/)
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

  it('modifies feature', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { feature: 'f-auth' })
    expect(task.feature).toBe('f-auth')
  })

  it('clears feature when set to empty string', () => {
    const doc = validDoc()
    doc.tasks[0].feature = 'f-old'
    const task = editTask(doc, 'U-001', { feature: null })
    expect(task.feature).toBeNull()
  })

  it('modifies riskLevel', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { riskLevel: 'critical' })
    expect(task.riskLevel).toBe('critical')
  })

  it('rejects invalid riskLevel', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { riskLevel: 'extreme' }))
      .toThrow(/Invalid riskLevel/)
  })

  it('modifies executionLane', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { executionLane: 'test' })
    expect(task.executionLane).toBe('test')
  })

  it('rejects invalid executionLane', () => {
    const doc = validDoc()
    expect(() => editTask(doc, 'U-001', { executionLane: 'designer' }))
      .toThrow(/Invalid executionLane/)
  })

  it('modifies writeScopes', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { writeScopes: ['src/**', 'test/**'] })
    expect(task.writeScopes).toEqual(['src/**', 'test/**'])
  })

  it('modifies requiresReview and rollbackPlan', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { requiresReview: true, rollbackPlan: 'revert commit' })
    expect(task.requiresReview).toBe(true)
    expect(task.rollbackPlan).toBe('revert commit')
  })

  it('modifies repos and deliveryNode', () => {
    const doc = validDoc()
    const task = editTask(doc, 'U-001', { repos: ['repo-a'], deliveryNode: 'V1' })
    expect(task.repos).toEqual(['repo-a'])
    expect(task.deliveryNode).toBe('V1')
  })

  it('refuses to edit done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    expect(() => editTask(doc, 'U-001', { name: 'Nope' }))
      .toThrow(/already done/)
  })

  it('allows metadata-only edits on done tasks when explicitly requested', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].evidence = 'completed evidence'
    doc.tasks[0].completedAt = '2026-05-11'

    const task = editTask(doc, 'U-001', {
      feature: 'f-history',
      deliveryNode: 'V1',
      executionLane: 'contract',
      tags: ['history'],
    }, { allowDoneMetadata: true })

    expect(task.status).toBe('done')
    expect(task.name).toBe('Task 1')
    expect(task.evidence).toBe('completed evidence')
    expect(task.completedAt).toBe('2026-05-11')
    expect(task.feature).toBe('f-history')
    expect(task.deliveryNode).toBe('V1')
    expect(task.executionLane).toBe('contract')
    expect(task.tags).toEqual(['history'])
  })

  it('rejects historical fact fields on done task metadata-only edits', () => {
    const historicalFactFields = ['name', 'priority', 'acceptance', 'deps', 'nextAction']

    for (const field of historicalFactFields) {
      const doc = validDoc()
      doc.tasks[0].status = 'done'
      expect(() => editTask(doc, 'U-001', { [field]: field === 'deps' ? ['U-002'] : 'changed' }, { allowDoneMetadata: true }))
        .toThrow(/metadata-only/)
    }
  })

  it('rejects removing existing forbidden side effects on done task metadata-only edits', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].evidence = 'completed evidence [no-forbidden: confirmed]'
    doc.tasks[0].acceptanceCriteria = {
      requiredTests: [],
      passConditions: [],
      forbiddenSideEffects: ['must not deploy'],
      negativeCases: [],
    }

    expect(() => editTask(doc, 'U-001', {
      acceptanceCriteria: {
        requiredTests: [],
        passConditions: ['metadata is queryable'],
        forbiddenSideEffects: [],
        negativeCases: [],
      },
    }, { allowDoneMetadata: true }))
      .toThrow(/forbiddenSideEffects/)
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
    expect(results[0].task.status).toBe('done')
    expect(results[0].task.evidence).toBe('all tests pass')
    expect(results[0].task.completedAt).toBe(today())
    expect(results[0].task.order).toBeNull()
    expect(results[0].task.nextAction).toBeNull()
    expect(results[0].task.blocks).toBeNull()
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
    expect(results[0].task.rule).toBe('verified-by-rule')
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
      nextAction: null, evidence: null, rule: null, aodsRefs: [], codeRefs: [], implementationTargets: [], tags: ['bug'],
      order: 3, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
    })
    const tasks = listTasks(doc, { status: 'pending', priority: 'P1', tag: 'bug' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-003')
  })

  it('filters by feature', () => {
    const doc = validDoc()
    doc.tasks[0].feature = 'f-auth'
    doc.tasks[1].feature = 'f-core'
    const tasks = listTasks(doc, { feature: 'f-auth' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
  })

  it('returns empty array when no matches', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'nonexistent' })
    expect(tasks).toHaveLength(0)
  })

  it('filters with all possible filters combined', () => {
    const doc = validDoc()
    doc.tasks[0].tags = ['bug']
    doc.tasks[0].feature = 'f-auth'
    const filtered = listTasks(doc, {
      status: 'pending',
      module: 'core',
      stage: 'S1',
      priority: 'P0',
      tag: 'bug',
      feature: 'f-auth',
      search: 'Task 1',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('U-001')
  })
})

// ── formatTaskTable ──

describe('formatTaskTable', () => {
  it('returns "(no tasks)" for empty list', () => {
    expect(formatTaskTable([])).toBe('(no tasks)')
  })

  it('returns header row and formatted tasks', () => {
    const doc = validDoc()
    const tasks = [doc.tasks[0], doc.tasks[1]]
    const output = formatTaskTable(tasks)
    const lines = output.split('\n')
    expect(lines).toHaveLength(4) // header + separator + 2 task rows
    expect(lines[0]).toContain('ID')
    expect(lines[0]).toContain('NAME')
    expect(lines[0]).toContain('STAGE')
    expect(lines[0]).toContain('STATUS')
    expect(lines[0]).toContain('PRIORITY')
    expect(lines[1]).toContain('------')
    expect(lines[2]).toContain('U-001')
    expect(lines[2]).toContain('Task 1')
    expect(lines[2]).toContain('S1')
    expect(lines[2]).toContain('pending')
    expect(lines[2]).toContain('P0')
    expect(lines[3]).toContain('U-002')
    expect(lines[3]).toContain('P1')
  })

  it('truncates long task names with ellipsis', () => {
    const doc = validDoc()
    doc.tasks[0].name = 'A very long task name that exceeds twenty eight characters'
    const output = formatTaskTable([doc.tasks[0]])
    const lines = output.split('\n')
    const taskLine = lines[2]
    expect(taskLine).toContain('…')
    expect(taskLine).not.toContain('characters')
  })

  it('handles task with done status correctly in formatting', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    const output = formatTaskTable([doc.tasks[0]])
    const lines = output.split('\n')
    expect(lines[2]).toContain('done')
  })

  it('handles task with blocked status correctly in formatting', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'blocked'
    doc.tasks[0].blocks = 'waiting on dep'
    const output = formatTaskTable([doc.tasks[0]])
    const lines = output.split('\n')
    expect(lines[2]).toContain('blocked')
  })
})

// ── formatTaskDetail ──

describe('formatTaskDetail', () => {
  function taskWithAllFields() {
    const doc = validDoc()
    const t = doc.tasks[0]
    t.riskLevel = 'critical'
    t.executionLane = 'writer'
    t.writeScopes = ['src/auth/**', 'src/db/**']
    t.repos = ['polaris-impl']
    t.deliveryNode = 'V2'
    t.requiresReview = true
    t.assignedAgent = 'agent-7'
    t.approvedBy = 'Alice'
    t.rollbackPlan = 'git revert HEAD~1 && make deploy-rollback'
    t.resourceRequirements = ['openai/gpt-4o', 'brave-search']
    t.executionPlan = {
      inputs: ['spec.md', 'schema.graphql'],
      outputs: ['auth.ts', 'auth.test.ts'],
      steps: ['read spec', 'implement auth', 'write tests'],
    }
    t.acceptanceCriteria = {
      requiredTests: ['unit: auth', 'integration: login flow'],
      passConditions: ['all tests green', 'coverage > 80%'],
      forbiddenSideEffects: ['no credential leaks'],
      negativeCases: ['invalid token', 'expired session'],
    }
    t.tags = ['security', 'critical']
    t.order = 5
    t.completedOrder = null
    t.claimedBy = 'agent-7'
    t.claimedAt = '2026-05-14'
    t.completedAt = null
    t.feature = 'f-auth'
    t.rule = 'ci-passed'
    t.evidence = 'all tests pass [test: 42 passed]'
    t.nextAction = 'deploy'
    t.blocks = null
    t.deps = ['U-002']
    doc.tasks[1].deps = [t.id] // U-002 depends on U-001
    return { doc, task: t }
  }

  it('displays all basic fields', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('ID:          U-001')
    expect(output).toContain('Name:        Task 1')
    expect(output).toContain('Status:      pending')
    expect(output).toContain('Priority:    P0')
    expect(output).toContain('Stage:       S1')
    expect(output).toContain('Module:      core')
    expect(output).toContain('Acceptance:  pass')
  })

  it('displays riskLevel and executionLane', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Risk:        critical')
    expect(output).toContain('Lane:        writer')
  })

  it('displays writeScopes and repos', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Write Scopes: src/auth/**, src/db/**')
    expect(output).toContain('Repos:       polaris-impl')
  })

  it('displays requiresReview as Yes when true', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Review:      Yes')
  })

  it('displays requiresReview as No when false', () => {
    const doc = validDoc()
    doc.tasks[0].requiresReview = false
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Review:      No')
  })

  it('displays deliveryNode and assignedAgent', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Delivery:    V2')
    expect(output).toContain('Assigned:    agent-7')
  })

  it('displays approvedBy', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Approved:    Alice')
  })

  it('displays executionPlan section when populated', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Exec Plan:')
    expect(output).toContain('inputs=[spec.md, schema.graphql]')
    expect(output).toContain('outputs=[auth.ts, auth.test.ts]')
    expect(output).toContain('read spec; implement auth; write tests')
  })

  it('does not display executionPlan when null', () => {
    const doc = validDoc()
    doc.tasks[0].executionPlan = null
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).not.toContain('Exec Plan:')
  })

  it('displays acceptanceCriteria sections when populated', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Tests:       unit: auth, integration: login flow')
    expect(output).toContain('Pass:        all tests green; coverage > 80%')
    expect(output).toContain('Forbidden:   no credential leaks')
    expect(output).toContain('Negatives:   invalid token; expired session')
  })

  it('does not display acceptanceCriteria when null', () => {
    const doc = validDoc()
    doc.tasks[0].acceptanceCriteria = null
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).not.toContain('Tests:')
    expect(output).not.toContain('Pass:')
  })

  it('displays rollbackPlan when set', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Rollback:    git revert HEAD~1 && make deploy-rollback')
  })

  it('does not display rollbackPlan when null', () => {
    const doc = validDoc()
    doc.tasks[0].rollbackPlan = null
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).not.toContain('Rollback:')
  })

  it('displays resourceRequirements when populated', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Resources:   openai/gpt-4o, brave-search')
  })

  it('displays "(none)" for empty resourceRequirements', () => {
    const doc = validDoc()
    doc.tasks[0].resourceRequirements = []
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Resources:   (none)')
  })

  it('displays deps correctly', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Deps:        U-002')
  })

  it('displays "(none)" for empty deps', () => {
    const doc = validDoc()
    doc.tasks[0].deps = []
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Deps:        (none)')
  })

  it('displays writeScopes as "(none)" when empty', () => {
    const doc = validDoc()
    doc.tasks[0].writeScopes = []
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Write Scopes: (none)')
  })

  it('displays repos as "(none)" when empty', () => {
    const doc = validDoc()
    doc.tasks[0].repos = []
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Repos:       (none)')
  })

  it('displays tags correctly', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Tags:        security, critical')
  })

  it('displays "(none)" for null nextAction/evidence/rule/feature/blocks', () => {
    const doc = validDoc()
    doc.tasks[0].nextAction = null
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Next Action: (none)')
    expect(output).toContain('Evidence:    (none)')
    expect(output).toContain('Rule:        (none)')
    expect(output).toContain('Feature:     (none)')
    expect(output).toContain('Blocks:      (none)')
    expect(output).toContain('Lane:        (none)')
    expect(output).toContain('Delivery:    (none)')
    expect(output).toContain('Assigned:    (none)')
    expect(output).toContain('Approved:    (none)')
  })

  it('displays "(none)" for null order/completedOrder', () => {
    const doc = validDoc()
    doc.tasks[0].order = null
    doc.tasks[0].completedOrder = null
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Order:       (none)')
    expect(output).toContain('Comp.Order:  (none)')
  })

  it('displays ancestors section', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Ancestors (depends on):')
    expect(output).toContain('U-002 [pending] Task 2')
  })

  it('displays descendants section', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Descendants (depends on this):')
    expect(output).toContain('U-002 [pending] Task 2')
  })

  it('displays completedAt and createdAt', () => {
    const { doc } = taskWithAllFields()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Created:     2026-05-10')
    expect(output).toContain('Completed:   (none)')
  })

  it('displays completedAt when set', () => {
    const { doc } = taskWithAllFields()
    doc.tasks[0].completedAt = '2026-05-14'
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('Completed:   2026-05-14')
  })
})

// ── markTasksDone with structured evidence ──

describe('markTasksDone with structured evidence', () => {
  it('stores evidence string containing structured flag content', () => {
    const doc = validDoc()
    // Simulate the evidence construction from the CLI handler:
    // parts = [evidence, [test: ...], [commit: ...], [review: ...], [provider: ...], [notes: ...]]
    const evidence = [
      'manual verification',
      '[test: 42 passed, 0 failed]',
      '[commit: abc1234]',
      '[review: approved by Bob]',
      '[provider: openai/gpt-4o]',
      '[notes: edge case covered]',
    ].join(' ')
    const results = markTasksDone(doc, ['U-001'], evidence, 'ci-verified')
    expect(results[0].task.evidence).toBe(evidence)
    expect(results[0].task.evidence).toContain('[test: 42 passed, 0 failed]')
    expect(results[0].task.evidence).toContain('[commit: abc1234]')
    expect(results[0].task.evidence).toContain('[review: approved by Bob]')
    expect(results[0].task.evidence).toContain('[provider: openai/gpt-4o]')
    expect(results[0].task.evidence).toContain('[notes: edge case covered]')
    expect(results[0].task.rule).toBe('ci-verified')
  })

  it('stores evidence with only --test flag', () => {
    const doc = validDoc()
    const evidence = 'tests completed [test: all green]'
    const results = markTasksDone(doc, ['U-001'], evidence)
    expect(results[0].task.evidence).toBe('tests completed [test: all green]')
  })

  it('stores evidence with only --commit flag', () => {
    const doc = validDoc()
    const evidence = 'deployed [commit: def5678]'
    const results = markTasksDone(doc, ['U-001'], evidence)
    expect(results[0].task.evidence).toBe('deployed [commit: def5678]')
  })

  it('stores evidence with --test and --review flags only', () => {
    const doc = validDoc()
    const evidence = 'code review done [test: 10/10] [review: Alice LGTM]'
    const results = markTasksDone(doc, ['U-001'], evidence)
    expect(results[0].task.evidence).toContain('[test: 10/10]')
    expect(results[0].task.evidence).toContain('[review: Alice LGTM]')
  })
})

// ── listTasks with extended filter coverage ──

describe('listTasks extended', () => {
  it('filters by status done returns only done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedOrder = 1
    const tasks = listTasks(doc, { status: 'done' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
    expect(tasks[0].status).toBe('done')
  })

  it('filters by status blocked returns only blocked tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'blocked'
    doc.tasks[0].blocks = 'waiting'
    const tasks = listTasks(doc, { status: 'blocked' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-001')
    expect(tasks[0].status).toBe('blocked')
  })

  it('filters by feature returns empty when no match', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { feature: 'nonexistent-feature' })
    expect(tasks).toHaveLength(0)
  })

  it('search matches substrings of name (case insensitive)', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'task' })
    expect(tasks).toHaveLength(2)
  })

  it('search matches substrings of id (case insensitive)', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, { search: 'u-00' })
    expect(tasks).toHaveLength(2)
  })

  it('returns all tasks when filter object is empty', () => {
    const doc = validDoc()
    const tasks = listTasks(doc, {})
    expect(tasks).toHaveLength(2)
  })

  it('filters with status and module combined', () => {
    const doc = validDoc()
    doc._meta.modules.push({ id: 'ui', name: 'UI' })
    doc.tasks[0].module = 'ui'
    doc.tasks[0].status = 'blocked'
    doc.tasks[1].status = 'blocked'
    const tasks = listTasks(doc, { status: 'blocked', module: 'core' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
  })

  it('filters by status open returns all non-done tasks', () => {
    const doc = validDoc()
    doc.tasks[0].status = 'done'
    doc.tasks[0].completedOrder = 1
    doc.tasks[1].status = 'blocked'
    doc.tasks[1].blocks = 'waiting'
    const tasks = listTasks(doc, { status: 'open' })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('U-002')
    expect(tasks[0].status).toBe('blocked')
  })

  it('filters by status open returns tasks with mixed non-done statuses', () => {
    const doc = validDoc()
    // U-001 stays pending, U-002 becomes done
    doc.tasks[1].status = 'done'
    doc.tasks[1].completedOrder = 1
    // Add a third task with a different non-done status
    doc.tasks.push({
      id: 'U-003', status: 'blocked', priority: 'P1', stage: 'S1', module: 'core',
      name: 'Task 3', acceptance: 'pass', deps: [], blocks: 'waiting',
      nextAction: null, evidence: null, rule: null, aodsRefs: [], codeRefs: [], implementationTargets: [], tags: [],
      order: 3, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
    } as any)
    const tasks = listTasks(doc, { status: 'open' })
    expect(tasks).toHaveLength(2)
    expect(tasks.map((t) => t.id).sort()).toEqual(['U-001', 'U-003'])
    expect(tasks.every((t) => t.status !== 'done')).toBe(true)
  })
})

// ── markTasksDone with noForbidden flag ──

describe('markTasksDone with noForbidden flag', () => {
  it('appends [no-forbidden: confirmed] to evidence when noForbidden is true', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'implemented feature', undefined, true)
    expect(results[0].task.evidence).toBe('implemented feature [no-forbidden: confirmed]')
  })

  it('does not append [no-forbidden] when flag is false', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'implemented feature', undefined, false)
    expect(results[0].task.evidence).toBe('implemented feature')
  })

  it('does not append [no-forbidden] when flag is omitted (backward compatible)', () => {
    const doc = validDoc()
    // No 5th argument → noForbidden is undefined → no tag appended
    const results = markTasksDone(doc, ['U-001'], 'implemented feature')
    expect(results[0].task.evidence).toBe('implemented feature')
  })

  it('works with --rule and --no-forbidden together', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'verified fix', 'ci-passed', true)
    expect(results[0].task.evidence).toBe('verified fix [no-forbidden: confirmed]')
    expect(results[0].task.rule).toBe('ci-passed')
  })

  it('appends [no-forbidden] to evidence that already has structured flags', () => {
    const doc = validDoc()
    const evidence = [
      'implemented feature',
      '[test: all green]',
      '[commit: abc123]',
    ].join(' ')
    const results = markTasksDone(doc, ['U-001'], evidence, undefined, true)
    expect(results[0].task.evidence).toContain('[test: all green]')
    expect(results[0].task.evidence).toContain('[commit: abc123]')
    expect(results[0].task.evidence).toContain('[no-forbidden: confirmed]')
  })
})

// ── markTasksDone returns DoneTaskResult with originalId and doneAlias ──

describe('markTasksDone DoneTaskResult fields', () => {
  it('returns originalId and doneAlias alongside the task', () => {
    const doc = validDoc()
    const results = markTasksDone(doc, ['U-001'], 'done evidence')
    expect(results).toHaveLength(1)
    expect(results[0].originalId).toBe('U-001')
    expect(results[0].doneAlias).toBe('D-001')
    expect(results[0].task.id).toBe('D-001')
    expect(results[0].task.name).toBe('Task 1')
  })

  it('preserves numeric part across U→D transition', () => {
    const doc = validDoc()
    // Create task with non-sequential initial ID to test
    doc.tasks.push({
      id: 'U-005', status: 'pending', priority: 'P1', stage: 'S1', module: 'core',
      name: 'Task 5', acceptance: 'pass', deps: [], blocks: null,
      nextAction: null, evidence: null, rule: null, aodsRefs: [], codeRefs: [], implementationTargets: [], tags: [],
      order: 3, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
    } as any)
    const results = markTasksDone(doc, ['U-005'], 'evidence')
    expect(results[0].originalId).toBe('U-005')
    expect(results[0].doneAlias).toBe('D-005')
    expect(results[0].task.id).toBe('D-005')
  })
})

// ── formatTaskDetail shows transition for D-prefixed tasks ──

describe('formatTaskDetail with ID transition', () => {
  it('shows both IDs for done tasks with D- prefix', () => {
    const doc = validDoc()
    // Mark a task done so it gets D- prefix
    markTasksDone(doc, ['U-001'], 'completed')
    const detail = getTaskDetail(doc, 'D-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('ID:          D-001 (was U-001)')
  })

  it('shows only single ID for non-done U-prefixed tasks', () => {
    const doc = validDoc()
    const detail = getTaskDetail(doc, 'U-001')
    const output = formatTaskDetail(detail)
    expect(output).toContain('ID:          U-001')
    expect(output).not.toContain('(was')
  })
})
