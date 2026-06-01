// cli/src/commands/template.ts
import { readFileSync } from 'fs'
import type { TallyDocument, Task, TemplateFile } from '../types.js'
import { today, nextOrder } from './task.js'

// ── Public API ──

/**
 * Read and validate a template JSON file.
 * Throws on missing file, invalid JSON, or missing required fields.
 */
export function loadTemplate(path: string): TemplateFile {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch {
    throw new Error(`Template file not found at ${path}`)
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid template JSON: ${(e as Error).message}`)
  }

  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Template must be a JSON object')
  }

  const obj = data as Record<string, unknown>

  if (!obj.module || typeof obj.module !== 'string') {
    throw new Error('Template must have a "module" field (string)')
  }

  if (!obj.tasks || !Array.isArray(obj.tasks)) {
    throw new Error('Template must have a "tasks" array')
  }
  if (obj.tasks.length === 0) {
    throw new Error('Template "tasks" array must not be empty')
  }

  for (let i = 0; i < obj.tasks.length; i++) {
    const t = obj.tasks[i] as Record<string, unknown> | null | undefined
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error(`Template task at index ${i} must be an object`)
    }
    if (!t.name || typeof t.name !== 'string') {
      throw new Error(`Template task at index ${i} must have a "name" field (string)`)
    }
  }

  return data as TemplateFile
}

/**
 * Derive a stage ID from a module by searching _meta.stages for a stage
 * whose modules array includes the given module.
 */
export function inferStage(doc: TallyDocument, module: string): string {
  for (const stage of doc._meta.stages) {
    if (stage.modules.includes(module)) {
      return stage.id
    }
  }
  throw new Error(
    `No stage found covering module "${module}". Add it to a stage in _meta.stages first.`,
  )
}

/**
 * Apply a template to a Tally document, creating all tasks in order.
 *
 * Tasks receive consecutive U-IDs. depsRefs of the form `$1`, `$2`, ... refer
 * to other template tasks by their 1-based position in the template.
 * Other depsRefs are resolved via the template's `depsRefMap`.
 *
 * Template-level `module` and `feature` are used as defaults for tasks that
 * don't specify their own.
 *
 * Returns the created Task objects (already pushed into doc.tasks).
 */
export function applyTemplate(doc: TallyDocument, template: TemplateFile): Task[] {
  // Validate template-level module
  if (!doc._meta.modules.some((m) => m.id === template.module)) {
    throw new Error(`Module "${template.module}" not found in _meta.modules`)
  }

  // Warn if template-level feature is missing from _meta.features
  if (template.feature != null) {
    const featureIds = new Set(doc._meta.features.map((f) => f.id))
    if (!featureIds.has(template.feature)) {
      console.warn(
        `Warning: Feature "${template.feature}" not found in _meta.features (lint will catch)`,
      )
    }
  }

  // Pre-compute consecutive U-IDs for all template tasks
  const existingNums = doc.tasks
    .map((t) => {
      const m = t.id.match(/^[UD]-(\d+)$/)
      return m ? parseInt(m[1], 10) : 0
    })
  const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0

  const assignedIds: string[] = []
  for (let i = 0; i < template.tasks.length; i++) {
    const num = maxNum + i + 1
    assignedIds.push(`U-${String(num).padStart(3, '0')}`)
  }

  const depsRefMap = template.depsRefMap ?? {}

  const created: Task[] = []

  for (let i = 0; i < template.tasks.length; i++) {
    const input = template.tasks[i]
    const module = input.module ?? template.module
    // Use task-level feature explicitly (including null) if present; otherwise fall back to template-level
    const feature = input.feature !== undefined ? input.feature : (template.feature ?? null)

    // Validate module before inferring stage so the error mentions the module
    if (!doc._meta.modules.some((m) => m.id === module)) {
      throw new Error(`Module "${module}" not found in _meta.modules`)
    }

    const stage = input.stage ?? inferStage(doc, module)

    // Validate stage
    const stageEntry = doc._meta.stages.find((s) => s.id === stage)
    if (!stageEntry) {
      throw new Error(`Stage "${stage}" not found in _meta.stages`)
    }
    if (!stageEntry.modules.includes(module)) {
      throw new Error(`Stage "${stage}" does not include module "${module}"`)
    }

    // Warn if task-level feature is missing
    if (input.feature != null) {
      const featureIds = new Set(doc._meta.features.map((f) => f.id))
      if (!featureIds.has(input.feature)) {
        console.warn(
          `Warning: Feature "${input.feature}" not found in _meta.features (lint will catch)`,
        )
      }
    }

    // Resolve deps: start with explicit deps, then resolve depsRefs
    const deps: string[] = [...(input.deps ?? [])]

    if (input.depsRefs) {
      for (const ref of input.depsRefs) {
        if (ref.startsWith('$')) {
          // Template-internal reference: "$1" = first template task, "$2" = second, etc.
          const idx = parseInt(ref.slice(1), 10)
          if (isNaN(idx) || idx < 1 || idx > template.tasks.length) {
            throw new Error(
              `Invalid depsRef "${ref}" in task at index ${i}: index must be 1..${template.tasks.length}`,
            )
          }
          // Prevent self-reference
          if (idx === i + 1) {
            throw new Error(
              `Invalid depsRef "${ref}" in task at index ${i}: a task cannot depend on itself`,
            )
          }
          deps.push(assignedIds[idx - 1])
        } else {
          // Symbolic reference via depsRefMap
          const resolved = depsRefMap[ref]
          if (!resolved) {
            throw new Error(
              `depsRef "${ref}" in task at index ${i} not found in depsRefMap`,
            )
          }
          deps.push(resolved)
        }
      }
    }

    const task: Task = {
      id: assignedIds[i],
      status: 'pending',
      priority: (input.priority as Task['priority']) ?? 'P1',
      stage,
      module,
      name: input.name,
      acceptance: input.acceptance ?? '待定义',
      deps,
      blocks: null,
      nextAction: null,
      evidence: null,
      rule: null,
      aodsRefs: input.aodsRefs ?? [],
      codeRefs: input.codeRefs ?? [],
      implementationTargets: input.implementationTargets ?? [],
      feature,
      tags: [],
      order: nextOrder(doc),
      completedOrder: null,
      claimedBy: null,
      claimedAt: null,
      createdAt: today(),
      completedAt: null,
      writeScopes: input.writeScopes ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? null,
      executionPlan: input.executionPlan ?? null,
      riskLevel: (input.riskLevel as Task['riskLevel']) ?? 'medium',
      rollbackPlan: input.rollbackPlan ?? null,
      executionLane: (input.executionLane as Task['executionLane']) ?? null,
      assignedAgent: null,
      requiresReview: input.requiresReview ?? false,
      resourceRequirements: input.resourceRequirements ?? [],
      repos: input.repos ?? [],
      deliveryNode: input.deliveryNode ?? null,
      approvedBy: null,
    }

    doc.tasks.push(task)
    created.push(task)
  }

  return created
}
