import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { TallyDocument, Task } from '../src/types.js'
import { checkPlans, registerPlan } from '../src/commands/plan.js'
import { linkTaskToPlan } from '../src/commands/task.js'

function makeTask(): Task {
  return {
    id: 'U-001',
    status: 'pending',
    priority: 'P1',
    stage: 'S1',
    module: 'core',
    name: 'Implement plan task',
    acceptance: 'passes',
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
  }
}

function makeDoc(): TallyDocument {
  return {
    _meta: {
      project: 'test',
      tally_version: '1.0',
      created: '2026-05-10',
      updated: '2026-05-10',
      agents: [{ id: 'main', name: 'Main' }],
      stages: [{ id: 'S1', name: 'Core', modules: ['core'] }],
      modules: [{ id: 'core', name: 'Core' }],
      features: [],
      plans: [],
    },
    tasks: [makeTask()],
    rounds: [],
    blocks: [],
    progress: [],
  }
}

describe('plan registry', () => {
  let dir: string
  let planPath: string

  beforeEach(() => {
    dir = mkdtempSync('/tmp/tally-plan-')
    mkdirSync(join(dir, 'docs', 'superpowers', 'plans'), { recursive: true })
    planPath = join(dir, 'docs', 'superpowers', 'plans', '2026-06-01-demo.md')
    writeFileSync(planPath, '# Demo Implementation Plan\n\n### Task 1: Build the feature\n\nDo it.\n')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('registers a Superpowers plan with title, path, and hash', () => {
    const doc = makeDoc()
    const plan = registerPlan(doc, dir, planPath)

    expect(plan.id).toBe('plan:demo-implementation-plan')
    expect(plan.title).toBe('Demo Implementation Plan')
    expect(plan.path).toBe('docs/superpowers/plans/2026-06-01-demo.md')
    expect(plan.kind).toBe('superpowers')
    expect(plan.requiredSkill).toBe('superpowers:subagent-driven-development')
    expect(plan.contentHash).toMatch(/^sha256:/)
    expect(doc._meta.plans).toHaveLength(1)
  })

  it('checks linked task refs against the registered plan', () => {
    const doc = makeDoc()
    const plan = registerPlan(doc, dir, planPath)
    const task = linkTaskToPlan(doc, 'U-001', plan.id, 'Task 1')

    expect(task.planRef).toBe(plan.id)
    expect(task.planPath).toBe(plan.path)
    expect(task.planContentHash).toBe(plan.contentHash)

    const result = checkPlans(doc, dir)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects plan hash drift', () => {
    const doc = makeDoc()
    registerPlan(doc, dir, planPath)
    writeFileSync(planPath, '# Demo Implementation Plan\n\nChanged.\n')

    const result = checkPlans(doc, dir)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.code === 'PLAN_HASH_DRIFT')).toBe(true)
  })

  it('detects missing task refs inside the plan', () => {
    const doc = makeDoc()
    const plan = registerPlan(doc, dir, planPath)
    linkTaskToPlan(doc, 'U-001', plan.id, 'Task 99')

    const result = checkPlans(doc, dir)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.code === 'PLAN_TASK_REF_MISSING')).toBe(true)
  })
})
