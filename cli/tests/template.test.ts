// cli/tests/template.test.ts
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { TallyDocument } from '../src/types.js'
import { loadTemplate, applyTemplate, inferStage } from '../src/commands/template.js'

// ── Helpers ──

function validDoc(): TallyDocument {
  return {
    _meta: {
      project: 'test',
      tally_version: '1.0',
      created: '2026-05-10',
      updated: '2026-05-10',
      agents: [{ id: 'main', name: 'Main' }],
      stages: [
        { id: 'S1', name: 'Core', modules: ['core'] },
        { id: 'S2', name: 'UI', modules: ['ui'] },
      ],
      modules: [
        { id: 'core', name: 'Core Module' },
        { id: 'ui', name: 'UI Module' },
      ],
      features: [
        {
          id: 'feat-a',
          module: 'core',
          name: 'Feature A',
          status: 'design',
          specRefs: [],
          dependsOn: [],
          owner: null,
        },
      ],
    },
    tasks: [],
    rounds: [],
    blocks: [],
    progress: [],
  }
}

function validTemplate() {
  return {
    module: 'core',
    feature: 'feat-a',
    tasks: [
      { name: 'Task 1', priority: 'P0' },
      { name: 'Task 2', priority: 'P1' },
    ],
  }
}

function tmpPath(name: string): string {
  return join(__dirname, 'fixtures', `__template_test_${name}.json`)
}

// ── loadTemplate ──

describe('loadTemplate', () => {
  it('reads and validates a valid template file', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('valid')
    const template = {
      module: 'core',
      tasks: [{ name: 'Task A' }],
    }
    writeFileSync(path, JSON.stringify(template))
    try {
      const result = loadTemplate(path)
      expect(result.module).toBe('core')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].name).toBe('Task A')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects missing file', () => {
    expect(() => loadTemplate('/nonexistent/template.json')).toThrow(
      'Template file not found at',
    )
  })

  it('rejects invalid JSON', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('invalid-json')
    writeFileSync(path, 'not json')
    try {
      expect(() => loadTemplate(path)).toThrow('Invalid template JSON')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects non-object root', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('array-root')
    writeFileSync(path, '[]')
    try {
      expect(() => loadTemplate(path)).toThrow('Template must be a JSON object')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects missing module', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('no-module')
    writeFileSync(path, JSON.stringify({ tasks: [{ name: 'T' }] }))
    try {
      expect(() => loadTemplate(path)).toThrow('Template must have a "module" field')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects missing tasks array', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('no-tasks')
    writeFileSync(path, JSON.stringify({ module: 'core' }))
    try {
      expect(() => loadTemplate(path)).toThrow('Template must have a "tasks" array')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects empty tasks array', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('empty-tasks')
    writeFileSync(path, JSON.stringify({ module: 'core', tasks: [] }))
    try {
      expect(() => loadTemplate(path)).toThrow('"tasks" array must not be empty')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects task without name', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('no-name')
    writeFileSync(path, JSON.stringify({ module: 'core', tasks: [{}] }))
    try {
      expect(() => loadTemplate(path)).toThrow('must have a "name" field')
    } finally {
      unlinkSync(path)
    }
  })

  it('rejects non-object task entry', () => {
    const dir = join(__dirname, 'fixtures')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const path = tmpPath('string-task')
    writeFileSync(path, JSON.stringify({ module: 'core', tasks: ['not an object'] }))
    try {
      expect(() => loadTemplate(path)).toThrow('must be an object')
    } finally {
      unlinkSync(path)
    }
  })
})

// ── inferStage ──

describe('inferStage', () => {
  it('finds stage that covers the module', () => {
    const doc = validDoc()
    expect(inferStage(doc, 'core')).toBe('S1')
    expect(inferStage(doc, 'ui')).toBe('S2')
  })

  it('throws when no stage covers the module', () => {
    const doc = validDoc()
    expect(() => inferStage(doc, 'unknown')).toThrow(
      'No stage found covering module "unknown"',
    )
  })
})

// ── applyTemplate ──

describe('applyTemplate', () => {
  it('creates tasks with consecutive U-IDs', () => {
    const doc = validDoc()
    const template = validTemplate()
    const created = applyTemplate(doc, template)

    expect(created).toHaveLength(2)
    expect(created[0].id).toBe('U-001')
    expect(created[1].id).toBe('U-002')
    expect(doc.tasks).toHaveLength(2)
  })

  it('continues ID sequence after existing tasks', () => {
    const doc = validDoc()
    doc.tasks.push({
      id: 'U-003',
      status: 'pending',
      priority: 'P1',
      stage: 'S1',
      module: 'core',
      name: 'Existing',
      acceptance: 'done',
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
    })

    const template = validTemplate()
    const created = applyTemplate(doc, template)
    expect(created[0].id).toBe('U-004')
    expect(created[1].id).toBe('U-005')
  })

  it('uses template-level module and feature as defaults', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      feature: 'feat-a',
      tasks: [{ name: 'Defaulted task' }],
    }
    const created = applyTemplate(doc, template)
    expect(created[0].module).toBe('core')
    expect(created[0].feature).toBe('feat-a')
  })

  it('allows task-level module override', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [{ name: 'UI Task', module: 'ui' }],
    }
    const created = applyTemplate(doc, template)
    expect(created[0].module).toBe('ui')
  })

  it('rejects a task-level stage/module mismatch', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [{ name: 'Wrong stage', stage: 'S1', module: 'ui' }],
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'Stage "S1" does not include module "ui"',
    )
  })

  it('allows task-level feature override', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      feature: 'feat-a',
      tasks: [{ name: 'Other feature', feature: null }],
    }
    const created = applyTemplate(doc, template)
    expect(created[0].feature).toBeNull()
  })

  it('warns but does not reject when feature is missing from _meta.features', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const doc = validDoc()
      const template = {
        module: 'core',
        feature: 'feat-b',
        tasks: [{ name: 'Task' }],
      }
      const created = applyTemplate(doc, template)
      expect(created).toHaveLength(1)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('feat-b'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('warns for task-level feature not in _meta.features', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const doc = validDoc()
      const template = {
        module: 'core',
        tasks: [{ name: 'Task', feature: 'feat-c' }],
      }
      const created = applyTemplate(doc, template)
      expect(created).toHaveLength(1)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('feat-c'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('rejects unknown module', () => {
    const doc = validDoc()
    const template = {
      module: 'nonexistent',
      tasks: [{ name: 'Task' }],
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'Module "nonexistent" not found in _meta.modules',
    )
  })

  it('rejects unknown task-level module', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [{ name: 'Task', module: 'nonexistent' }],
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'Module "nonexistent" not found in _meta.modules',
    )
  })

  it('resolves $N depsRefs to other template tasks', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'First' },
        { name: 'Second', depsRefs: ['$1'] },
        { name: 'Third', depsRefs: ['$1', '$2'] },
      ],
    }
    const created = applyTemplate(doc, template)
    expect(created[1].deps).toEqual(['U-001'])
    expect(created[2].deps).toEqual(['U-001', 'U-002'])
  })

  it('resolves depsRefMap symbolic names to existing ledger IDs', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'New task', depsRefs: ['existing-dep'] },
      ],
      depsRefMap: { 'existing-dep': 'U-099' },
    }
    const created = applyTemplate(doc, template)
    expect(created[0].deps).toEqual(['U-099'])
  })

  it('combines deps and depsRefs', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'First' },
        { name: 'Second', deps: ['U-010'], depsRefs: ['$1', 'ext-ref'] },
      ],
      depsRefMap: { 'ext-ref': 'U-020' },
    }
    const created = applyTemplate(doc, template)
    expect(created[1].deps).toEqual(['U-010', 'U-001', 'U-020'])
  })

  it('rejects $N depsRef with out-of-range index', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'Task', depsRefs: ['$99'] },
      ],
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'index must be 1..1',
    )
  })

  it('rejects $N depsRef with self-reference', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'Self-ref', depsRefs: ['$1'] },
      ],
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'cannot depend on itself',
    )
  })

  it('rejects depsRef not in depsRefMap', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'Task', depsRefs: ['unknown-ref'] },
      ],
      depsRefMap: {},
    }
    expect(() => applyTemplate(doc, template)).toThrow(
      'not found in depsRefMap',
    )
  })

  it('injects all rich fields from template task input', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        {
          name: 'Rich task',
          priority: 'P0',
          acceptance: 'Must pass all tests',
          writeScopes: ['src/core/**'],
          executionLane: 'writer',
          executionPlan: {
            inputs: ['spec'],
            outputs: ['code'],
            steps: ['write', 'test'],
          },
          acceptanceCriteria: {
            requiredTests: ['npm test'],
            passConditions: ['green'],
            forbiddenSideEffects: ['no crash'],
            negativeCases: ['empty input'],
          },
          riskLevel: 'high',
          requiresReview: true,
          rollbackPlan: 'revert commit',
          resourceRequirements: ['gpu'],
          repos: ['my-repo'],
          deliveryNode: 'v1.0',
        },
      ],
    }
    const created = applyTemplate(doc, template)
    const t = created[0]
    expect(t.priority).toBe('P0')
    expect(t.acceptance).toBe('Must pass all tests')
    expect(t.writeScopes).toEqual(['src/core/**'])
    expect(t.executionLane).toBe('writer')
    expect(t.executionPlan).toEqual({ inputs: ['spec'], outputs: ['code'], steps: ['write', 'test'] })
    expect(t.acceptanceCriteria).toEqual({
      requiredTests: ['npm test'],
      passConditions: ['green'],
      forbiddenSideEffects: ['no crash'],
      negativeCases: ['empty input'],
    })
    expect(t.riskLevel).toBe('high')
    expect(t.requiresReview).toBe(true)
    expect(t.rollbackPlan).toBe('revert commit')
    expect(t.resourceRequirements).toEqual(['gpu'])
    expect(t.repos).toEqual(['my-repo'])
    expect(t.deliveryNode).toBe('v1.0')
  })

  it('uses defaults when optional fields are not provided', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [{ name: 'Minimal task' }],
    }
    const created = applyTemplate(doc, template)
    const t = created[0]
    expect(t.status).toBe('pending')
    expect(t.priority).toBe('P1')
    expect(t.acceptance).toBe('待定义')
    expect(t.deps).toEqual([])
    expect(t.writeScopes).toEqual([])
    expect(t.riskLevel).toBe('medium')
    expect(t.requiresReview).toBe(false)
    expect(t.resourceRequirements).toEqual([])
    expect(t.repos).toEqual([])
    expect(t.executionLane).toBeNull()
    expect(t.deliveryNode).toBeNull()
    expect(t.rollbackPlan).toBeNull()
    expect(t.acceptanceCriteria).toBeNull()
    expect(t.executionPlan).toBeNull()
    expect(t.assignedAgent).toBeNull()
    expect(t.approvedBy).toBeNull()
    expect(t.tags).toEqual([])
  })

  it('outputs summary format for multiple tasks', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [
        { name: 'Task A' },
        { name: 'Task B' },
        { name: 'Task C' },
      ],
    }
    const created = applyTemplate(doc, template)
    const ids = created.map((t) => t.id)
    const range = ids.length === 1 ? ids[0] : `${ids[0]}..${ids[ids.length - 1]}`
    expect(range).toBe('U-001..U-003')
  })

  it('outputs single ID for single-task template', () => {
    const doc = validDoc()
    const template = {
      module: 'core',
      tasks: [{ name: 'Only task' }],
    }
    const created = applyTemplate(doc, template)
    const ids = created.map((t) => t.id)
    const range = ids.length === 1 ? ids[0] : `${ids[0]}..${ids[ids.length - 1]}`
    expect(range).toBe('U-001')
  })
})
