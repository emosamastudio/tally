// cli/src/schema.ts

import Ajv from 'ajv/dist/2020.js'
import type { CheckError, CheckResult, LintError, LintResult } from './types.js'

// ── JSON Schema ──

/**
 * JSON Schema v2020-12 for the Tally document (.tally/tally.json).
 *
 * Validates field types, required fields, enum membership, and array/item
 * shapes.  Constraints that require cross-field or cross-item reasoning
 * (evidence ↔ status, ID uniqueness, reference integrity, dependency
 * cycles) are enforced by the custom validator functions below, not by
 * this schema.
 */
export const TALLY_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://tally.dev/schema/tally-document.json',
  type: 'object',
  properties: {
    _meta: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        tally_version: { type: 'string' },
        created: { type: 'string' },
        updated: { type: 'string' },
        agents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
            additionalProperties: false,
          },
        },
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              modules: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'name', 'modules'],
            additionalProperties: false,
          },
        },
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
            additionalProperties: false,
          },
        },
        features: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              module: { type: 'string' },
              name: { type: 'string' },
              status: { enum: ['design', 'contract_frozen', 'implementing', 'stable'] },
              specRefs: { type: 'array', items: { type: 'string' } },
              dependsOn: { type: 'array', items: { type: 'string' } },
              owner: { type: ['string', 'null'] },
            },
            required: ['id', 'module', 'name', 'status', 'specRefs', 'dependsOn', 'owner'],
            additionalProperties: false,
          },
        },
        plans: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              path: { type: 'string' },
              title: { type: 'string' },
              kind: { type: 'string' },
              requiredSkill: { type: ['string', 'null'] },
              contentHash: { type: 'string' },
              status: { enum: ['active', 'archived', 'superseded'] },
              registeredAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
            required: [
              'id',
              'path',
              'title',
              'kind',
              'requiredSkill',
              'contentHash',
              'status',
              'registeredAt',
              'updatedAt',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['project', 'tally_version', 'created', 'updated', 'agents', 'stages', 'modules', 'features'],
      additionalProperties: false,
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: {
            enum: ['pending', 'in_progress', 'blocked', 'hold', 'deferred', 'done'],
          },
          priority: { enum: ['P0', 'P1', 'P2'] },
          stage: { type: 'string' },
          module: { type: 'string' },
          name: { type: 'string' },
          acceptance: { type: 'string' },
          deps: { type: 'array', items: { type: 'string' } },
          blocks: { type: ['string', 'null'] },
          nextAction: { type: ['string', 'null'] },
          evidence: { type: ['string', 'null'] },
          rule: { type: ['string', 'null'] },
          aodsRefs: { type: 'array', items: { type: 'string' } },
          codeRefs: { type: 'array', items: { type: 'string' } },
          implementationTargets: { type: 'array', items: { type: 'string' } },
          feature: { type: ['string', 'null'] },
          tags: { type: 'array', items: { type: 'string' } },
          order: { type: ['integer', 'null'] },
          completedOrder: { type: ['integer', 'null'] },
          claimedBy: { type: ['string', 'null'] },
          claimedAt: { type: ['string', 'null'] },
          createdAt: { type: 'string' },
          completedAt: { type: ['string', 'null'] },
          planRef: { type: ['string', 'null'] },
          planPath: { type: ['string', 'null'] },
          planTaskRef: { type: ['string', 'null'] },
          planContentHash: { type: ['string', 'null'] },
          writeScopes: { type: 'array', items: { type: 'string' } },
          acceptanceCriteria: {
            type: ['object', 'null'],
            properties: {
              requiredTests: { type: 'array', items: { type: 'string' } },
              passConditions: { type: 'array', items: { type: 'string' } },
              forbiddenSideEffects: { type: 'array', items: { type: 'string' } },
              negativeCases: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
          executionPlan: {
            type: ['object', 'null'],
            properties: {
              inputs: { type: 'array', items: { type: 'string' } },
              outputs: { type: 'array', items: { type: 'string' } },
              steps: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
          riskLevel: { enum: ['low', 'medium', 'high', 'critical'] },
          rollbackPlan: { type: ['string', 'null'] },
          executionLane: { enum: ['contract', 'writer', 'runtime', 'ui', 'test', 'review', null] },
          assignedAgent: { type: ['string', 'null'] },
          requiresReview: { type: 'boolean' },
          resourceRequirements: { type: 'array', items: { type: 'string' } },
          repos: { type: 'array', items: { type: 'string' } },
          deliveryNode: { type: ['string', 'null'] },
          approvedBy: { type: ['string', 'null'] },
        },
        required: [
          'id',
          'status',
          'priority',
          'stage',
          'module',
          'name',
          'acceptance',
          'deps',
          'blocks',
          'nextAction',
          'evidence',
          'rule',
          'aodsRefs',
          'codeRefs',
          'implementationTargets',
          'feature',
          'tags',
          'order',
          'completedOrder',
          'claimedBy',
          'claimedAt',
          'createdAt',
          'completedAt',
          'writeScopes',
          'acceptanceCriteria',
          'executionPlan',
          'riskLevel',
          'rollbackPlan',
          'executionLane',
          'assignedAgent',
          'requiresReview',
          'resourceRequirements',
          'repos',
          'deliveryNode',
          'approvedBy',
        ],
        additionalProperties: false,
      },
    },
    rounds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          start: { type: 'string' },
          executor: { type: 'string' },
          scope: { type: 'string' },
          exclusions: { type: 'string' },
          plannedTasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                goal: { type: 'string' },
                criteria: { type: 'string' },
              },
              required: ['taskId', 'goal', 'criteria'],
              additionalProperties: false,
            },
          },
          completedAt: { type: ['string', 'null'] },
          status: { enum: ['active', 'completed'] },
        },
        required: [
          'id',
          'start',
          'executor',
          'scope',
          'exclusions',
          'plannedTasks',
          'completedAt',
          'status',
        ],
        additionalProperties: false,
      },
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          affects: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' },
          strategy: { type: 'string' },
          createdAt: { type: 'string' },
          resolvedAt: { type: ['string', 'null'] },
        },
        required: ['id', 'affects', 'content', 'strategy', 'createdAt', 'resolvedAt'],
        additionalProperties: false,
      },
    },
    progress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          totalDone: { type: 'integer' },
          totalOpen: { type: 'integer' },
          totalHold: { type: 'integer' },
          totalBlocked: { type: 'integer' },
          evidence: { type: 'string' },
          notes: { type: 'string' },
        },
        required: [
          'date',
          'totalDone',
          'totalOpen',
          'totalHold',
          'totalBlocked',
          'evidence',
          'notes',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['_meta', 'tasks', 'rounds', 'blocks', 'progress'],
  additionalProperties: false,
} as const

// ── Compiled validator (lazy) ──

let _ajv: Ajv | null = null
let _validate: ReturnType<Ajv['compile']> | null = null

function getValidator(): ReturnType<Ajv['compile']> {
  if (_validate) return _validate
  _ajv = new Ajv({ allErrors: true, strict: false })
  _validate = _ajv.compile(TALLY_JSON_SCHEMA)
  return _validate
}

// ── Helpers ──

/** Extract a value at a JSON Pointer-ish path (only simple segments). */
function safeGet(obj: unknown, ...segments: (string | number)[]): unknown {
  let cur = obj
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[seg]
  }
  return cur
}

function formatPath(...segments: (string | number)[]): string {
  return '/' + segments.map(String).join('/')
}

// ── Structural validations (lint) ──

/**
 * Evidence constraint:
 *   done    → evidence must be non-null
 *   non-done → evidence must be null AND nextAction must be non-null
 */
function checkEvidence(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []
  const tasks = safeGet(doc, 'tasks')
  if (!Array.isArray(tasks)) return errors

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>
    const status = t.status
    const evidence = t.evidence
    const nextAction = t.nextAction

    if (status === 'done') {
      if (evidence === null || evidence === undefined) {
        errors.push({
          path: formatPath('tasks', i, 'evidence'),
          message: 'Done task must have non-null evidence',
        })
      }
    } else {
      if (evidence !== null && evidence !== undefined) {
        errors.push({
          path: formatPath('tasks', i, 'evidence'),
          message: 'Non-done task must have null evidence',
        })
      }
      if (nextAction === null || nextAction === undefined) {
        errors.push({
          path: formatPath('tasks', i, 'nextAction'),
          message: 'Non-done task must have non-null nextAction',
        })
      }
    }
  }
  return errors
}

/** Check for duplicate IDs among tasks, rounds, and blocks. */
function checkIdUniqueness(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []

  const seenTaskIds = new Map<string, number>()
  const tasks = safeGet(doc, 'tasks')
  if (Array.isArray(tasks)) {
    for (let i = 0; i < tasks.length; i++) {
      const id = (tasks[i] as Record<string, unknown>).id as string | undefined
      if (id === undefined) continue
      const prev = seenTaskIds.get(id)
      if (prev !== undefined) {
        errors.push({
          path: formatPath('tasks', i, 'id'),
          message: `Duplicate task ID "${id}" (first seen at /tasks/${prev}/id)`,
        })
      } else {
        seenTaskIds.set(id, i)
      }
    }
  }

  const seenRoundIds = new Map<string, number>()
  const rounds = safeGet(doc, 'rounds')
  if (Array.isArray(rounds)) {
    for (let i = 0; i < rounds.length; i++) {
      const id = (rounds[i] as Record<string, unknown>).id as string | undefined
      if (id === undefined) continue
      const prev = seenRoundIds.get(id)
      if (prev !== undefined) {
        errors.push({
          path: formatPath('rounds', i, 'id'),
          message: `Duplicate round ID "${id}" (first seen at /rounds/${prev}/id)`,
        })
      } else {
        seenRoundIds.set(id, i)
      }
    }
  }

  const seenBlockIds = new Map<string, number>()
  const blocks = safeGet(doc, 'blocks')
  if (Array.isArray(blocks)) {
    for (let i = 0; i < blocks.length; i++) {
      const id = (blocks[i] as Record<string, unknown>).id as string | undefined
      if (id === undefined) continue
      const prev = seenBlockIds.get(id)
      if (prev !== undefined) {
        errors.push({
          path: formatPath('blocks', i, 'id'),
          message: `Duplicate block ID "${id}" (first seen at /blocks/${prev}/id)`,
        })
      } else {
        seenBlockIds.set(id, i)
      }
    }
  }

  return errors
}

/** Check for duplicate order values among non-done tasks and duplicate completedOrder values among done tasks. */
function checkOrderUniqueness(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []
  const tasks = safeGet(doc, 'tasks')
  if (!Array.isArray(tasks)) return errors

  const seenOrder = new Map<number, number>()
  const seenCompletedOrder = new Map<number, number>()

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>
    const status = t.status
    const order = t.order as number | null
    const completedOrder = t.completedOrder as number | null

    if (status === 'done') {
      if (completedOrder !== null && completedOrder !== undefined) {
        const prev = seenCompletedOrder.get(completedOrder)
        if (prev !== undefined) {
          errors.push({
            path: formatPath('tasks', i, 'completedOrder'),
            message: `Duplicate completedOrder ${completedOrder} (first seen at /tasks/${prev}/completedOrder)`,
          })
        } else {
          seenCompletedOrder.set(completedOrder, i)
        }
      }
    } else {
      if (order !== null && order !== undefined) {
        const prev = seenOrder.get(order)
        if (prev !== undefined) {
          errors.push({
            path: formatPath('tasks', i, 'order'),
            message: `Duplicate order ${order} (first seen at /tasks/${prev}/order)`,
          })
        } else {
          seenOrder.set(order, i)
        }
      }
    }
  }

  return errors
}

// ── Semantic validations (validateDocument only) ──

interface TaskInfo {
  id: string
  deps: string[]
  claimedBy: string | null
  claimedAt: string | null
}

interface RoundInfo {
  id: string
  executor: string
  plannedTaskIds: string[]
}

interface BlockInfo {
  id: string
  affects: string[]
}

/** Detect cycles in the dependency graph using DFS. */
function checkDependencyCycles(tasks: TaskInfo[]): CheckError[] {
  const errors: CheckError[] = []
  const taskIndex = new Map<string, number>()
  for (let i = 0; i < tasks.length; i++) {
    taskIndex.set(tasks[i].id, i)
  }

  // 0 = unvisited, 1 = in current path, 2 = fully explored
  const state = new Array(tasks.length).fill(0)

  function dfs(idx: number, path: string[]): boolean {
    if (state[idx] === 1) {
      // Found a cycle — find where the cycle starts in the path
      const cycleStart = path.indexOf(tasks[idx].id)
      const cycleNodes = path.slice(cycleStart).concat(tasks[idx].id)
      errors.push({
        code: 'DEPENDENCY_CYCLE',
        message: `Dependency cycle detected: ${cycleNodes.join(' → ')}`,
      })
      return true
    }
    if (state[idx] === 2) return false

    state[idx] = 1
    path.push(tasks[idx].id)

    for (const depId of tasks[idx].deps) {
      const depIdx = taskIndex.get(depId)
      if (depIdx !== undefined) {
        if (dfs(depIdx, path)) return true // Stop at first cycle per component
      }
    }

    path.pop()
    state[idx] = 2
    return false
  }

  for (let i = 0; i < tasks.length; i++) {
    if (state[i] === 0) {
      dfs(i, [])
    }
  }

  return errors
}

/** Check that all IDs referenced in deps, claimedBy, plannedTasks, and affects exist. */
function checkReferenceIntegrity(
  tasks: TaskInfo[],
  rounds: RoundInfo[],
  blocks: BlockInfo[],
): CheckError[] {
  const errors: CheckError[] = []

  const taskIdSet = new Set(tasks.map((t) => t.id))
  const roundIdSet = new Set(rounds.map((r) => r.id))

  // task deps → tasks
  for (let i = 0; i < tasks.length; i++) {
    for (let j = 0; j < tasks[i].deps.length; j++) {
      const dep = tasks[i].deps[j]
      if (!taskIdSet.has(dep)) {
        errors.push({
          code: 'REFERENCE_INVALID',
          message: `Task "${tasks[i].id}" depends on non-existent task "${dep}"`,
          path: formatPath('tasks', i, 'deps', j),
        })
      }
    }
  }

  // claimedBy → rounds (lint already checks null consistency)
  for (let i = 0; i < tasks.length; i++) {
    const claimedBy = tasks[i].claimedBy
    if (claimedBy !== null && !roundIdSet.has(claimedBy)) {
      errors.push({
        code: 'REFERENCE_INVALID',
        message: `Task "${tasks[i].id}" claimedBy references non-existent round "${claimedBy}"`,
        path: formatPath('tasks', i, 'claimedBy'),
      })
    }
  }

  // plannedTasks.taskId → tasks
  for (let r = 0; r < rounds.length; r++) {
    for (let p = 0; p < rounds[r].plannedTaskIds.length; p++) {
      const ptid = rounds[r].plannedTaskIds[p]
      if (!taskIdSet.has(ptid)) {
        errors.push({
          code: 'REFERENCE_INVALID',
          message: `Round "${rounds[r].id}" planned task references non-existent task "${ptid}"`,
          path: formatPath('rounds', r, 'plannedTasks', p, 'taskId'),
        })
      }
    }
  }

  // blocks.affects → tasks
  for (let b = 0; b < blocks.length; b++) {
    for (let a = 0; a < blocks[b].affects.length; a++) {
      const aff = blocks[b].affects[a]
      if (!taskIdSet.has(aff)) {
        errors.push({
          code: 'REFERENCE_INVALID',
          message: `Block "${blocks[b].id}" affects non-existent task "${aff}"`,
          path: formatPath('blocks', b, 'affects', a),
        })
      }
    }
  }

  return errors
}

/** Check stale claims: claimedBy ↔ claimedAt consistency. */
function checkStaleClaims(tasks: TaskInfo[]): CheckError[] {
  const errors: CheckError[] = []
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const hasClaimedBy = t.claimedBy !== null
    const hasClaimedAt = t.claimedAt !== null

    if (hasClaimedBy && !hasClaimedAt) {
      errors.push({
        code: 'STALE_CLAIM',
        message: `Task "${t.id}" has claimedBy set but claimedAt is null`,
        path: formatPath('tasks', i, 'claimedAt'),
      })
    }
    if (!hasClaimedBy && hasClaimedAt) {
      errors.push({
        code: 'STALE_CLAIM',
        message: `Task "${t.id}" has claimedAt set but claimedBy is null`,
        path: formatPath('tasks', i, 'claimedBy'),
      })
    }
  }
  return errors
}

/** Check that round.executor references a valid _meta.agents[].id. */
function checkAgentReferences(
  rounds: RoundInfo[],
  agentIds: Set<string>,
): CheckError[] {
  const errors: CheckError[] = []
  for (let r = 0; r < rounds.length; r++) {
    if (!agentIds.has(rounds[r].executor)) {
      errors.push({
        code: 'AGENT_REFERENCE_INVALID',
        message: `Round "${rounds[r].id}" executor "${rounds[r].executor}" not found in _meta.agents`,
        path: formatPath('rounds', r, 'executor'),
      })
    }
  }
  return errors
}

/**
 * For done tasks with non-null, non-empty acceptanceCriteria.forbiddenSideEffects,
 * verify the evidence string contains a `[no-forbidden]` tag confirming the agent
 * checked that none of the forbidden side effects were triggered.
 */
function checkForbiddenSideEffects(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []
  const tasks = safeGet(doc, 'tasks')
  if (!Array.isArray(tasks)) return errors

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>
    const status = t.status

    if (status !== 'done') continue

    const acceptanceCriteria = t.acceptanceCriteria as Record<string, unknown> | null | undefined
    if (acceptanceCriteria == null) continue

    const forbidden = acceptanceCriteria.forbiddenSideEffects as string[] | undefined
    if (!forbidden || forbidden.length === 0) continue

    const evidence = t.evidence as string | null | undefined
    const hasNoForbidden = typeof evidence === 'string' && evidence.includes('[no-forbidden')
    if (!hasNoForbidden) {
      errors.push({
        path: formatPath('tasks', i, 'evidence'),
        message: `Done task has forbiddenSideEffects but evidence does not include [no-forbidden] confirmation`,
      })
    }
  }
  return errors
}

/** Check that task.feature references a valid _meta.features[].id. */
function checkFeatureReferences(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []
  const meta = safeGet(doc, '_meta')
  const features = meta != null && typeof meta === 'object'
    ? (meta as Record<string, unknown>).features
    : undefined
  const featureIds = new Set<string>()
  if (Array.isArray(features)) {
    for (const f of features) {
      if (f != null && typeof f === 'object') {
        const fid = (f as Record<string, unknown>).id as string | undefined
        if (fid) featureIds.add(fid)
      }
    }
  }

  const tasks = safeGet(doc, 'tasks')
  if (!Array.isArray(tasks)) return errors

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>
    const feature = t.feature as string | null | undefined
    if (feature != null && !featureIds.has(feature)) {
      errors.push({
        path: formatPath('tasks', i, 'feature'),
        message: `Task feature "${feature}" not found in _meta.features`,
      })
    }
  }
  return errors
}

/** Check that task.planRef references a registered _meta.plans[].id. */
function checkPlanReferences(doc: Record<string, unknown>): LintError[] {
  const errors: LintError[] = []
  const meta = safeGet(doc, '_meta')
  const plans = meta != null && typeof meta === 'object'
    ? (meta as Record<string, unknown>).plans
    : undefined

  const planIds = new Set<string>()
  if (Array.isArray(plans)) {
    const seen = new Map<string, number>()
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]
      if (plan == null || typeof plan !== 'object') continue
      const id = (plan as Record<string, unknown>).id as string | undefined
      if (!id) continue
      const prev = seen.get(id)
      if (prev !== undefined) {
        errors.push({
          path: formatPath('_meta', 'plans', i, 'id'),
          message: `Duplicate plan ID "${id}" (first seen at /_meta/plans/${prev}/id)`,
        })
      } else {
        seen.set(id, i)
        planIds.add(id)
      }
    }
  }

  const tasks = safeGet(doc, 'tasks')
  if (!Array.isArray(tasks)) return errors

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>
    const planRef = t.planRef as string | null | undefined
    if (planRef != null && !planIds.has(planRef)) {
      errors.push({
        path: formatPath('tasks', i, 'planRef'),
        message: `Task planRef "${planRef}" not found in _meta.plans`,
      })
    }
  }

  return errors
}

// ── Public API ──

/**
 * Fast structural validation: JSON Schema + evidence constraint + ID
 * uniqueness + order uniqueness.  Suitable for pre-commit checks.
 *
 * Does NOT perform semantic checks (cycles, reference integrity, stale
 * claims, agent references).
 */
export function lintDocument(doc: unknown): LintResult {
  const errors: LintError[] = []

  // 1. JSON Schema validation
  const validate = getValidator()
  const schemaOk = validate(doc)
  if (!schemaOk && validate.errors) {
    for (const e of validate.errors) {
      errors.push({
        path: e.instancePath || '/',
        message: e.message ?? 'Schema validation error',
      })
    }
  }

  // If schema validation failed, the document might not have the expected
  // shape — still try structural checks but guard carefully.
  const record = doc as Record<string, unknown> | null | undefined
  if (record != null && typeof record === 'object') {
    // 2. Evidence constraint
    errors.push(...checkEvidence(record))

    // 3. ID uniqueness
    errors.push(...checkIdUniqueness(record))

    // 4. Order uniqueness
    errors.push(...checkOrderUniqueness(record))

    // 5. Feature references
    errors.push(...checkFeatureReferences(record))

    // 6. Forbidden side effects check
    errors.push(...checkForbiddenSideEffects(record))

    // 7. Plan references
    errors.push(...checkPlanReferences(record))
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Full validation: everything `lintDocument` checks plus semantic
 * validations (dependency cycles, reference integrity, stale claims,
 * agent references).  Suitable for `tally check`.
 */
export function validateDocument(doc: unknown): CheckResult {
  const lintResult = lintDocument(doc)

  // Convert lint errors to check errors
  const checkErrors: CheckError[] = lintResult.errors.map((e) => ({
    code: 'SCHEMA_INVALID',
    message: e.message,
    path: e.path,
  }))
  const warnings: CheckError[] = []

  // Only run semantic checks if the document has the right shape
  const record = doc as Record<string, unknown> | null | undefined
  if (record != null && typeof record === 'object') {
    const tasksRaw = safeGet(record, 'tasks')
    const roundsRaw = safeGet(record, 'rounds')
    const blocksRaw = safeGet(record, 'blocks')

    if (Array.isArray(tasksRaw)) {
      const tasks: TaskInfo[] = []
      for (const t of tasksRaw) {
        if (t != null && typeof t === 'object') {
          tasks.push({
            id: (t as Record<string, unknown>).id as string,
            deps: ((t as Record<string, unknown>).deps as string[]) ?? [],
            claimedBy: ((t as Record<string, unknown>).claimedBy as string | null) ?? null,
            claimedAt: ((t as Record<string, unknown>).claimedAt as string | null) ?? null,
          })
        }
      }

      // Dependency cycle detection
      checkErrors.push(...checkDependencyCycles(tasks))

      // Stale claims
      checkErrors.push(...checkStaleClaims(tasks))

      if (Array.isArray(roundsRaw)) {
        const rounds: RoundInfo[] = []
        for (const r of roundsRaw) {
          if (r != null && typeof r === 'object') {
            const ro = r as Record<string, unknown>
            const pts = ro.plannedTasks
            rounds.push({
              id: ro.id as string,
              executor: ro.executor as string,
              plannedTaskIds: Array.isArray(pts)
                ? pts.map((pt: Record<string, unknown>) => pt.taskId as string)
                : [],
            })
          }
        }

        if (Array.isArray(blocksRaw)) {
          const blocks: BlockInfo[] = []
          for (const b of blocksRaw) {
            if (b != null && typeof b === 'object') {
              blocks.push({
                id: (b as Record<string, unknown>).id as string,
                affects: ((b as Record<string, unknown>).affects as string[]) ?? [],
              })
            }
          }

          // Reference integrity
          checkErrors.push(...checkReferenceIntegrity(tasks, rounds, blocks))
        }

        // Agent references
        const meta = safeGet(record, '_meta')
        const agents = meta != null && typeof meta === 'object'
          ? (meta as Record<string, unknown>).agents
          : undefined
        const agentIds = new Set<string>()
        if (Array.isArray(agents)) {
          for (const a of agents) {
            if (a != null && typeof a === 'object') {
              const aid = (a as Record<string, unknown>).id as string | undefined
              if (aid) agentIds.add(aid)
            }
          }
        }
        checkErrors.push(...checkAgentReferences(rounds, agentIds))

        // Feature-module mismatch check
        const featureMap = new Map<string, string>() // feature id → module
        const featuresRaw = meta != null && typeof meta === 'object'
          ? (meta as Record<string, unknown>).features
          : undefined
        if (Array.isArray(featuresRaw)) {
          for (const f of featuresRaw) {
            if (f != null && typeof f === 'object') {
              const fr = f as Record<string, unknown>
              const fid = fr.id as string | undefined
              const fmod = fr.module as string | undefined
              if (fid && fmod) featureMap.set(fid, fmod)
            }
          }
        }
        for (let i = 0; i < tasks.length; i++) {
          const t = tasksRaw[i] as Record<string, unknown>
          const taskFeature = t.feature as string | null | undefined
          const taskModule = t.module as string | undefined
          if (taskFeature != null && taskModule != null) {
            const featureModule = featureMap.get(taskFeature)
            if (featureModule != null && featureModule !== taskModule) {
              checkErrors.push({
                code: 'FEATURE_MODULE_MISMATCH',
                message: `Task "${tasks[i].id}" feature "${taskFeature}" belongs to module "${featureModule}" but task is in module "${taskModule}"`,
                path: formatPath('tasks', i, 'feature'),
              })
            }
          }
        }

        // Feature-required warnings
        if (Array.isArray(tasksRaw)) {
          for (const rawTask of tasksRaw) {
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              const status = t.status as string | undefined
              const feature = t.feature as string | null | undefined
              if (status !== 'done' && status !== 'hold' && (feature === null || feature === undefined)) {
                warnings.push({
                  code: 'FEATURE_REQUIRED',
                  message: `Open task "${t.id}" should have a non-null feature`,
                })
              }
            }
          }
        }

        // Risk gating warnings
        if (Array.isArray(tasksRaw)) {
          for (const rawTask of tasksRaw) {
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              const riskLevel = t.riskLevel as string | undefined
              const requiresReview = t.requiresReview as boolean | undefined
              const rollbackPlan = t.rollbackPlan as string | null | undefined
              if (riskLevel === 'high' || riskLevel === 'critical') {
                if (!requiresReview) {
                  warnings.push({
                    code: 'REVIEW_RECOMMENDED',
                    message: `High/critical risk task "${t.id}" should require review`,
                  })
                }
                if (!rollbackPlan) {
                  warnings.push({
                    code: 'ROLLBACK_RECOMMENDED',
                    message: `High/critical risk task "${t.id}" should have a rollback plan`,
                  })
                }
              }
            }
          }
        }

        // Stale task warnings
        if (Array.isArray(tasksRaw)) {
          const doneIds = new Set<string>()
          for (const rawTask of tasksRaw) {
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              if (t.status === 'done') doneIds.add(t.id as string)
            }
          }
          for (const rawTask of tasksRaw) {
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              const status = t.status as string | undefined
              const deps = t.deps as string[] | undefined
              if (status === 'pending' && deps && deps.length > 0 && deps.every((d: string) => doneIds.has(d))) {
                warnings.push({
                  code: 'STALE_TASK',
                  message: `Task "${t.id}" is pending but all dependencies are done`,
                })
              }
            }
          }
        }

        // Forbidden side effects not checked warning
        if (Array.isArray(tasksRaw)) {
          for (let i = 0; i < tasksRaw.length; i++) {
            const rawTask = tasksRaw[i]
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              const status = t.status as string | undefined
              const evidence = t.evidence as string | null | undefined
              const ac = t.acceptanceCriteria as Record<string, unknown> | null | undefined
              if (status === 'done' && ac != null) {
                const forbidden = ac.forbiddenSideEffects as string[] | undefined
                if (forbidden && forbidden.length > 0) {
                  const hasNoForbidden = typeof evidence === 'string' && evidence.includes('[no-forbidden')
                  if (!hasNoForbidden) {
                    warnings.push({
                      code: 'FORBIDDEN_NOT_CHECKED',
                      message: `Done task "${t.id}" has forbiddenSideEffects but evidence does not confirm they were checked with [no-forbidden]`,
                      path: formatPath('tasks', i, 'evidence'),
                    })
                  }
                }
              }
            }
          }

          // Drift detection: done tasks with insufficient evidence
          for (let i = 0; i < tasksRaw.length; i++) {
            const rawTask = tasksRaw[i]
            if (rawTask != null && typeof rawTask === 'object') {
              const t = rawTask as Record<string, unknown>
              if (t.status !== 'done') continue
              const evidence = (t.evidence as string) ?? ''
              const hasTest = evidence.includes('[test:')
              const hasCommit = evidence.includes('[commit:')
              const hasReview = evidence.includes('[review:')
              const hasProvider = evidence.includes('[provider:')
              const requiresReview = t.requiresReview === true
              const ac = t.acceptanceCriteria as Record<string, unknown> | null | undefined
              const hasForbidden = (ac?.forbiddenSideEffects as string[] | undefined)?.length ?? 0 > 0

              // Compute quality score
              let score = 0
              if (hasTest) score += 25
              if (hasCommit) score += 25
              if (hasReview || !requiresReview) score += 25
              if (evidence.includes('[no-forbidden') || !hasForbidden) score += 25

              // Low quality warning
              if (score < 50) {
                warnings.push({
                  code: 'DRIFT_LOW_QUALITY',
                  message: `Done task "${t.id}" has low evidence quality (${score}/100)`,
                  path: formatPath('tasks', i, 'evidence'),
                })
              }

              // Task writes code but no commit recorded
              const writeScopes = t.writeScopes as string[] | undefined
              if (writeScopes && writeScopes.length > 0 && !hasCommit) {
                warnings.push({
                  code: 'DRIFT_NO_COMMIT',
                  message: `Done task "${t.id}" has writeScopes but no [commit:] evidence`,
                  path: formatPath('tasks', i, 'evidence'),
                })
              }

              // Task requires review but none recorded
              if (t.requiresReview === true && !hasReview) {
                warnings.push({
                  code: 'DRIFT_NO_REVIEW',
                  message: `Done task "${t.id}" requires review but no [review:] evidence`,
                  path: formatPath('tasks', i, 'evidence'),
                })
              }

              // Task has no structured evidence at all
              if (!hasTest && !hasCommit && !hasReview && !hasProvider) {
                warnings.push({
                  code: 'DRIFT_NO_EVIDENCE',
                  message: `Done task "${t.id}" has no structured evidence (no [test:], [commit:], [review:], or [provider:])`,
                  path: formatPath('tasks', i, 'evidence'),
                })
              }

              // Resource-using task without provider evidence
              const resources = t.resourceRequirements as string[] | undefined
              if (resources && resources.length > 0 && !hasProvider) {
                warnings.push({
                  code: 'DRIFT_NO_PROVIDER',
                  message: `Done task "${t.id}" uses resources but no [provider:] evidence`,
                  path: formatPath('tasks', i, 'evidence'),
                })
              }
            }
          }
        }
      }
    }

    // Cross-feature undeclared dependency check
    if (Array.isArray(tasksRaw)) {
      const meta = safeGet(record, '_meta')
      const featuresRaw = meta != null && typeof meta === 'object'
        ? (meta as Record<string, unknown>).features
        : undefined
      const taskFeature = new Map<string, string>()
      for (const rawTask of tasksRaw) {
        if (rawTask != null && typeof rawTask === 'object') {
          const t = rawTask as Record<string, unknown>
          const fid = (t.feature as string) ?? '__none__'
          taskFeature.set(t.id as string, fid)
        }
      }
      const featureDeps = new Map<string, Set<string>>()
      if (Array.isArray(featuresRaw)) {
        for (const f of featuresRaw) {
          if (f != null && typeof f === 'object') {
            const fr = f as Record<string, unknown>
            const deps = fr.dependsOn as string[] | undefined
            if (deps && deps.length > 0) {
              featureDeps.set(fr.id as string, new Set(deps))
            }
          }
        }
      }
      for (const rawTask of tasksRaw) {
        if (rawTask != null && typeof rawTask === 'object') {
          const t = rawTask as Record<string, unknown>
          const taskFid = taskFeature.get(t.id as string) ?? '__none__'
          if (taskFid === '__none__') continue
          const deps = t.deps as string[] | undefined
          if (!deps || deps.length === 0) continue
          for (const depId of deps) {
            const depFid = taskFeature.get(depId) ?? '__none__'
            if (depFid === '__none__' || depFid === taskFid) continue
            const declared = featureDeps.get(taskFid)
            if (!declared || !declared.has(depFid)) {
              warnings.push({
                code: 'CROSS_FEATURE_DEP_UNDECLARED',
                message: `Task "${t.id}" (feature "${taskFid}") depends on "${depId}" (feature "${depFid}") but feature "${taskFid}" does not declare dependsOn "${depFid}"`,
                path: formatPath('tasks', tasksRaw.indexOf(rawTask), 'deps'),
              })
            }
          }
        }
      }
    }
  }

  return {
    valid: checkErrors.length === 0,
    errors: checkErrors,
    warnings,
  }
}
