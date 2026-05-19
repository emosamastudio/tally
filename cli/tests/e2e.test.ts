import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const CLI = join(__dirname, '..', 'dist', 'index.js')

function run(args: string[], cwd: string): string {
  return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' })
}

/** Run a CLI command that may exit with non-zero code. Returns combined stdout+stderr. */
function runLax(args: string[], cwd: string): string {
  const cmd = `node ${CLI} ${args.join(' ')} 2>&1`
  try {
    return execFileSync(cmd, { cwd, encoding: 'utf-8', shell: true })
  } catch (e: any) {
    return e.stdout ?? ''
  }
}

function runLaxSafe(args: string[], cwd: string): string {
  try {
    return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8', stderr: 'pipe' })
  } catch (e: any) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

function readDoc(cwd: string): any {
  return JSON.parse(readFileSync(join(cwd, 'tally.json'), 'utf-8'))
}

describe('tally end-to-end', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync('/tmp/tally-e2e-')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('full round lifecycle: init -> add -> start -> done -> close -> verify', () => {
    // Init
    run(['init', 'e2e-test', '--no-hook'], dir)
    const doc1 = readDoc(dir)
    expect(doc1._meta.project).toBe('e2e-test')

    // Add tasks
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Task Alpha', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'alpha done' },
      { name: 'Task Beta', stage: 'S1', module: 'core', priority: 'P1', acceptance: 'beta done', deps: ['U-001'] },
      { name: 'Task Gamma', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'gamma done' },
    ])], dir)
    const doc2 = readDoc(dir)
    expect(doc2.tasks.length).toBe(3)
    const ids = doc2.tasks.map((t: any) => t.id)
    expect(ids[0]).toMatch(/^U-001$/)
    expect(ids[1]).toMatch(/^U-002$/)

    // Start round (will skip U-002 since deps not satisfied)
    const roundOut = run(['round', 'start', 'e2e-test-round', '--tasks', ids[0], ids[2]], dir)
    expect(roundOut).toContain('R-')

    const doc3 = readDoc(dir)
    expect(doc3.rounds.length).toBe(1)
    expect(doc3.rounds[0].status).toBe('active')
    expect(doc3.rounds[0].plannedTasks.length).toBe(2)

    // Mark tasks done
    run(['task', 'done', ids[0], ids[2], '--evidence', 'e2e smoke passed'], dir)

    const doc4 = readDoc(dir)
    const t1 = doc4.tasks.find((t: any) => t.id.startsWith('D-') && t.evidence === 'e2e smoke passed')
    expect(t1).toBeTruthy()

    // Close round
    run(['round', 'close'], dir)

    const doc5 = readDoc(dir)
    expect(doc5.rounds[0].status).toBe('completed')
    expect(doc5.rounds[0].completedAt).toBeTruthy()
    expect(doc5.progress.length).toBe(1)
    expect(doc5.progress[0].totalDone).toBe(2)
  })

  it('tally lint --json returns valid JSON', () => {
    run(['init', 'lint-test', '--no-hook'], dir)
    const out = run(['lint', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.valid).toBe(true)
  })

  it('tally check --json returns valid JSON', () => {
    run(['init', 'check-test', '--no-hook'], dir)
    const out = run(['check', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.valid).toBe(true)
  })

  it('tally status --json returns correct shape', () => {
    run(['init', 'status-test', '--no-hook'], dir)
    const out = run(['status', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.totalDone).toBe(0)
    expect(result.totalOpen).toBe(0)
    expect(result.totalHold).toBe(0)
    expect(result.activeRoundId).toBeNull()
  })

  it('tally graph --format json returns valid structure', () => {
    run(['init', 'graph-test', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'A', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'B', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok', deps: ['U-001'] },
    ])], dir)
    const out = run(['graph', '--format', 'json'], dir)
    const result = JSON.parse(out)
    expect(result.nodes.length).toBe(2)
    expect(result.edges.length).toBe(1)
  })

  it('tally export --format csv outputs CSV with header', () => {
    run(['init', 'export-test', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Export Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['export', '--format', 'csv'], dir)
    expect(out).toContain('id,name,status,priority,stage,module')
  })

  // ── Feature-related e2e ──

  it('init creates features: [] in _meta', () => {
    run(['init', 'feature-init', '--no-hook'], dir)
    const doc = readDoc(dir)
    expect(doc._meta.features).toEqual([])
  })

  it('feature add registers a feature under an existing module', () => {
    run(['init', 'feature-register', '--no-hook'], dir)
    run(['feature', 'add', 'f-base', '--module', 'core', '--name', 'Base Feature'], dir)

    run([
      'feature',
      'add',
      'f-history',
      '--module',
      'core',
      '--name',
      'Historical Migration',
      '--status',
      'stable',
      '--spec-refs',
      'spec-a,spec-b',
      '--depends-on',
      'f-base',
      '--owner',
      'main',
    ], dir)

    const doc = readDoc(dir)
    expect(doc._meta.features[1]).toEqual({
      id: 'f-history',
      module: 'core',
      name: 'Historical Migration',
      status: 'stable',
      specRefs: ['spec-a', 'spec-b'],
      dependsOn: ['f-base'],
      owner: 'main',
    })
  })

  it('feature add rejects missing modules and duplicate ids', () => {
    run(['init', 'feature-register-rejects', '--no-hook'], dir)

    const missingModule = runLaxSafe([
      'feature',
      'add',
      'f-history',
      '--module',
      'missing',
      '--name',
      'Historical Migration',
      '--json-output',
    ], dir)
    expect(JSON.parse(missingModule).ok).toBe(false)

    run(['feature', 'add', 'f-history', '--module', 'core', '--name', 'Historical Migration'], dir)
    const duplicate = runLaxSafe([
      'feature',
      'add',
      'f-history',
      '--module',
      'core',
      '--name',
      'Historical Migration',
      '--json-output',
    ], dir)
    const result = JSON.parse(duplicate)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('already exists')
  })

  it('feature add normalizes list fields and rejects invalid feature metadata', () => {
    run(['init', 'feature-register-normalizes', '--no-hook'], dir)
    run(['feature', 'add', 'f-base', '--module', 'core', '--name', 'Base Feature'], dir)

    run([
      'feature',
      'add',
      'f-history',
      '--module',
      'core',
      '--name',
      ' Historical Migration ',
      '--spec-refs',
      ' spec-a, spec-a, spec-b ',
      '--depends-on',
      ' f-base, f-base ',
      '--owner',
      ' main ',
    ], dir)

    const doc = readDoc(dir)
    expect(doc._meta.features[1]).toMatchObject({
      name: 'Historical Migration',
      specRefs: ['spec-a', 'spec-b'],
      dependsOn: ['f-base'],
      owner: 'main',
    })

    const blankName = runLaxSafe([
      'feature',
      'add',
      'f-blank',
      '--module',
      'core',
      '--name',
      '   ',
      '--json-output',
    ], dir)
    const result = JSON.parse(blankName)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('FEATURE_INVALID')
  })

  it('feature add emits feature-specific JSON errors', () => {
    run(['init', 'feature-register-json-errors', '--no-hook'], dir)

    const missingModule = runLaxSafe([
      'feature',
      'add',
      'f-history',
      '--module',
      'missing',
      '--name',
      'Historical Migration',
      '--json-output',
    ], dir)
    expect(JSON.parse(missingModule).error).toBe('FEATURE_MODULE_NOT_FOUND')

    const missingDependency = runLaxSafe([
      'feature',
      'add',
      'f-history',
      '--module',
      'core',
      '--name',
      'Historical Migration',
      '--depends-on',
      'f-missing',
      '--json-output',
    ], dir)
    expect(JSON.parse(missingDependency).error).toBe('FEATURE_DEP_NOT_FOUND')
  })

  it('feature list --json emits JSON errors when no ledger exists', () => {
    const out = runLaxSafe(['feature', 'list', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.ok).toBe(false)
  })

  it('feature list --json outputs registered features', () => {
    run(['init', 'feature-list-command', '--no-hook'], dir)
    run(['feature', 'add', 'f-history', '--module', 'core', '--name', 'Historical Migration'], dir)

    const out = run(['feature', 'list', '--json'], dir)
    const features = JSON.parse(out)
    expect(features).toEqual([
      expect.objectContaining({ id: 'f-history', module: 'core', name: 'Historical Migration' }),
    ])
  })

  it('module add registers modules for historical taxonomy migration', () => {
    run(['init', 'module-register', '--no-hook'], dir)
    run(['module', 'add', 'runtime-adapters', '--name', 'Runtime Adapters'], dir)

    const doc = readDoc(dir)
    expect(doc._meta.modules).toContainEqual({
      id: 'runtime-adapters',
      name: 'Runtime Adapters',
    })
  })

  it('module add rejects duplicate ids and blank metadata', () => {
    run(['init', 'module-register-rejects', '--no-hook'], dir)
    run(['module', 'add', 'runtime-adapters', '--name', 'Runtime Adapters'], dir)

    const duplicate = runLaxSafe([
      'module',
      'add',
      'runtime-adapters',
      '--name',
      'Runtime Adapters',
      '--json-output',
    ], dir)
    expect(JSON.parse(duplicate)).toMatchObject({
      ok: false,
      error: 'MODULE_ALREADY_EXISTS',
    })

    const blankName = runLaxSafe([
      'module',
      'add',
      'blank-module',
      '--name',
      '   ',
      '--json-output',
    ], dir)
    expect(JSON.parse(blankName)).toMatchObject({
      ok: false,
      error: 'MODULE_INVALID',
    })
  })

  it('stage add registers stages and binds existing modules', () => {
    run(['init', 'stage-register', '--no-hook'], dir)
    run(['module', 'add', 'runtime-adapters', '--name', 'Runtime Adapters'], dir)
    run(['module', 'add', 'resource-authority', '--name', 'Resource Authority'], dir)

    run([
      'stage',
      'add',
      'runtime-execution',
      '--name',
      'Runtime Execution',
      '--modules',
      'runtime-adapters,resource-authority,runtime-adapters',
    ], dir)

    const doc = readDoc(dir)
    expect(doc._meta.stages).toContainEqual({
      id: 'runtime-execution',
      name: 'Runtime Execution',
      modules: ['runtime-adapters', 'resource-authority'],
    })
  })

  it('stage add rejects missing modules, duplicate ids, and empty module lists', () => {
    run(['init', 'stage-register-rejects', '--no-hook'], dir)
    run(['module', 'add', 'runtime-adapters', '--name', 'Runtime Adapters'], dir)
    run([
      'stage',
      'add',
      'runtime-execution',
      '--name',
      'Runtime Execution',
      '--modules',
      'runtime-adapters',
    ], dir)

    const duplicate = runLaxSafe([
      'stage',
      'add',
      'runtime-execution',
      '--name',
      'Runtime Execution',
      '--modules',
      'runtime-adapters',
      '--json-output',
    ], dir)
    expect(JSON.parse(duplicate)).toMatchObject({
      ok: false,
      error: 'STAGE_ALREADY_EXISTS',
    })

    const missingModule = runLaxSafe([
      'stage',
      'add',
      'portfolio',
      '--name',
      'Portfolio',
      '--modules',
      'portfolio-governance',
      '--json-output',
    ], dir)
    expect(JSON.parse(missingModule)).toMatchObject({
      ok: false,
      error: 'STAGE_MODULE_NOT_FOUND',
    })

    const emptyModules = runLaxSafe([
      'stage',
      'add',
      'empty',
      '--name',
      'Empty Stage',
      '--modules',
      '  ',
      '--json-output',
    ], dir)
    expect(JSON.parse(emptyModules)).toMatchObject({
      ok: false,
      error: 'STAGE_INVALID',
    })
  })

  it('task add emits a specific JSON error when module is outside the selected stage', () => {
    run(['init', 'stage-module-mismatch', '--no-hook'], dir)
    run(['module', 'add', 'operator-console', '--name', 'Operator Console'], dir)

    const mismatch = runLaxSafe([
      'task',
      'add',
      '--json',
      JSON.stringify([
        {
          name: 'Bad mapping',
          stage: 'S1',
          module: 'operator-console',
          priority: 'P0',
          acceptance: 'ok',
        },
      ]),
      '--json-output',
    ], dir)
    expect(JSON.parse(mismatch)).toMatchObject({
      ok: false,
      error: 'STAGE_MODULE_MISMATCH',
    })
  })

  it('task add --json accepts feature field', () => {
    run(['init', 'feature-add', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Login', stage: 'S1', module: 'core', feature: 'f-login', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const doc = readDoc(dir)
    expect(doc.tasks[0].feature).toBe('f-login')
  })

  it('task edit --feature sets feature on task', () => {
    run(['init', 'feature-edit', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Edit Me', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'edit', 'U-001', '--feature', 'f-edit'], dir)
    const doc = readDoc(dir)
    expect(doc.tasks[0].feature).toBe('f-edit')
  })

  it('task edit --allow-done-metadata updates completed task metadata without changing completion facts', () => {
    run(['init', 'done-metadata-edit', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Completed task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'done', 'U-001', '--evidence', 'original evidence'], dir)

    run([
      'task',
      'edit',
      'D-001',
      '--allow-done-metadata',
      '--feature',
      'f-history',
      '--delivery-node',
      'GOV',
      '--execution-lane',
      'contract',
      '--repos',
      'repo-a,repo-b',
      '--tags',
      'history,standardized',
      '--acceptance-criteria-json',
      JSON.stringify({
        requiredTests: ['historical evidence retained'],
        passConditions: ['metadata is queryable'],
        negativeCases: ['missing historical evidence remains visible'],
      }),
      '--execution-plan-json',
      JSON.stringify({
        inputs: ['completed task'],
        outputs: ['metadata-only update'],
        steps: ['preserve completion facts', 'write metadata fields'],
      }),
    ], dir)

    const doc = readDoc(dir)
    const task = doc.tasks[0]
    const completedAt = task.completedAt
    expect(task.id).toBe('D-001')
    expect(task.status).toBe('done')
    expect(task.name).toBe('Completed task')
    expect(task.priority).toBe('P0')
    expect(task.acceptance).toBe('ok')
    expect(task.deps).toEqual([])
    expect(task.nextAction).toBeNull()
    expect(task.evidence).toBe('original evidence')
    expect(completedAt).toBeTruthy()
    expect(task.feature).toBe('f-history')
    expect(task.deliveryNode).toBe('GOV')
    expect(task.executionLane).toBe('contract')
    expect(task.repos).toEqual(['repo-a', 'repo-b'])
    expect(task.tags).toEqual(['history', 'standardized'])
    expect(task.acceptanceCriteria?.passConditions).toEqual(['metadata is queryable'])
    expect(task.executionPlan?.outputs).toEqual(['metadata-only update'])
  })

  it('task edit --allow-done-metadata rejects historical fact changes on completed tasks', () => {
    run(['init', 'done-metadata-edit-rejects-facts', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Immutable completed task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'done', 'U-001', '--evidence', 'original evidence'], dir)

    const out = runLaxSafe([
      'task',
      'edit',
      'D-001',
      '--allow-done-metadata',
      '--name',
      'Changed historical name',
      '--json-output',
    ], dir)

    const result = JSON.parse(out)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('DONE_TASK_FACT_FIELD_CHANGE')
    expect(result.message).toContain('metadata-only')

    const doc = readDoc(dir)
    expect(doc.tasks[0].name).toBe('Immutable completed task')
    expect(doc.tasks[0].evidence).toBe('original evidence')
  })

  it('task edit --allow-done-metadata rejects forbidden side effects without preserved confirmation', () => {
    run(['init', 'done-metadata-edit-rejects-forbidden-side-effects', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Completed task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'done', 'U-001', '--evidence', 'original evidence'], dir)

    const out = runLaxSafe([
      'task',
      'edit',
      'D-001',
      '--allow-done-metadata',
      '--acceptance-criteria-json',
      JSON.stringify({
        forbiddenSideEffects: ['must not change historical evidence'],
      }),
      '--json-output',
    ], dir)

    const result = JSON.parse(out)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('DONE_TASK_FACT_FIELD_CHANGE')
    expect(result.message).toContain('forbiddenSideEffects')
  })

  it('task list --feature filters by feature', () => {
    run(['init', 'feature-list', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Auth Task', stage: 'S1', module: 'core', feature: 'f-auth', priority: 'P0', acceptance: 'ok' },
      { name: 'Core Task', stage: 'S1', module: 'core', feature: 'f-core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['task', 'list', '--feature', 'f-auth'], dir)
    expect(out).toContain('Auth Task')
    expect(out).not.toContain('Core Task')
  })

  it('graph --format json includes feature in nodes', () => {
    run(['init', 'feature-graph', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'A', stage: 'S1', module: 'core', feature: 'f1', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['graph', '--format', 'json'], dir)
    const result = JSON.parse(out)
    expect(result.nodes[0].feature).toBe('f1')
  })

  it('export --format csv includes feature column', () => {
    run(['init', 'feature-csv', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'CSV Task', stage: 'S1', module: 'core', feature: 'f-csv', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['export', '--format', 'csv'], dir)
    expect(out).toContain('feature')
    expect(out).toContain('f-csv')
  })

  it('export --format markdown includes feature column', () => {
    run(['init', 'feature-md', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'MD Task', stage: 'S1', module: 'core', feature: 'f-md', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['export', '--format', 'markdown'], dir)
    expect(out).toContain('功能')
    expect(out).toContain('f-md')
  })

  it('lint catches invalid feature reference', () => {
    run(['init', 'feature-lint', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Bad Feature', stage: 'S1', module: 'core', feature: 'no-such-feature', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = runLax(['lint', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: any) => e.path?.includes('feature'))).toBe(true)
  })

  it('check catches feature-module mismatch', () => {
    run(['init', 'feature-mismatch', '--no-hook'], dir)
    // Manually inject a features registry and a task with mismatched feature module
    const doc = readDoc(dir)
    doc._meta.features = [{ id: 'f1', module: 'auth', name: 'Auth Feature' }]
    doc._meta.modules.push({ id: 'auth', name: 'Auth' })
    doc.tasks.push({
      id: 'U-001', status: 'pending', priority: 'P0', stage: 'S1', module: 'core',
      name: 'Mismatch Task', acceptance: 'ok', deps: [], blocks: null,
      nextAction: 'do it', evidence: null, rule: null, feature: 'f1', tags: [],
      order: 1, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-10', completedAt: null,
      writeScopes: [], acceptanceCriteria: null, executionPlan: null,
      riskLevel: 'medium', rollbackPlan: null, executionLane: null,
      assignedAgent: null, requiresReview: false, resourceRequirements: [],
      repos: [], deliveryNode: null, approvedBy: null,
    })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(doc, null, 2))
    const out = runLax(['check', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: any) => e.code === 'FEATURE_MODULE_MISMATCH')).toBe(true)
  })

  it('upgrade backfills feature schema for legacy v1.0 ledgers', () => {
    const legacy = {
      _meta: {
        project: 'legacy',
        tally_version: '1.0',
        created: '2026-05-10',
        updated: '2026-05-10',
        agents: [{ id: 'main', name: 'Main' }],
        stages: [{ id: 'S1', name: 'Stage 1', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
      },
      tasks: [
        {
          id: 'D-001', status: 'done', priority: 'P0', stage: 'S1', module: 'core',
          name: 'Old Done', acceptance: 'ok', deps: [], blocks: null,
          nextAction: null, evidence: 'done', rule: null, feature: null, tags: [],
          order: null, completedOrder: 1, claimedBy: null, claimedAt: null,
          createdAt: '2026-05-10', completedAt: '2026-05-10',
          writeScopes: [], acceptanceCriteria: null, executionPlan: null,
          riskLevel: 'medium', rollbackPlan: null, executionLane: null,
          assignedAgent: null, requiresReview: false, resourceRequirements: [],
          repos: [], deliveryNode: null, approvedBy: null,
        },
        {
          id: 'U-002', status: 'pending', priority: 'P1', stage: 'S1', module: 'core',
          name: 'Old Pending', acceptance: 'ok', deps: [], blocks: null,
          nextAction: 'do it', evidence: null, rule: null, feature: null, tags: [],
          order: 1, completedOrder: null, claimedBy: null, claimedAt: null,
          createdAt: '2026-05-10', completedAt: null,
          writeScopes: [], acceptanceCriteria: null, executionPlan: null,
          riskLevel: 'medium', rollbackPlan: null, executionLane: null,
          assignedAgent: null, requiresReview: false, resourceRequirements: [],
          repos: [], deliveryNode: null, approvedBy: null,
        },
      ],
      rounds: [],
      blocks: [],
      progress: [],
    }

    writeFileSync(join(dir, 'tally.json'), JSON.stringify(legacy, null, 2))
    const out = run(['upgrade'], dir)
    const doc = readDoc(dir)

    expect(out).toContain('feature-schema-backfill')
    expect(doc._meta.features).toEqual([])
    expect(doc.tasks.map((t: any) => t.feature)).toEqual([null, null])
    const lintOut = run(['lint', '--json'], dir)
    expect(JSON.parse(lintOut).valid).toBe(true)
  })

  it('upgrade backfills v0.2 safety fields for legacy v1.0 ledgers', () => {
    const legacy = {
      _meta: {
        project: 'legacy-v02',
        tally_version: '1.0',
        created: '2026-05-10',
        updated: '2026-05-10',
        agents: [{ id: 'main', name: 'Main' }],
        stages: [{ id: 'S1', name: 'Stage 1', modules: ['core'] }],
        modules: [{ id: 'core', name: 'Core' }],
        features: [{ id: 'f-core', module: 'core', name: 'Core Feature' }],
      },
      tasks: [
        {
          id: 'U-001',
          status: 'pending',
          priority: 'P0',
          stage: 'S1',
          module: 'core',
          feature: 'f-core',
          name: 'Legacy Pending',
          acceptance: 'ok',
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
      ],
      rounds: [],
      blocks: [],
      progress: [],
    }

    writeFileSync(join(dir, 'tally.json'), JSON.stringify(legacy, null, 2))
    const out = run(['upgrade'], dir)
    const doc = readDoc(dir)

    expect(out).toContain('v0.2-safety-field-backfill')
    expect(doc._meta.features[0]).toMatchObject({
      id: 'f-core',
      status: 'design',
      specRefs: [],
      dependsOn: [],
      owner: null,
    })
    expect(doc.tasks[0]).toMatchObject({
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
    const lintOut = run(['lint', '--json'], dir)
    expect(JSON.parse(lintOut).valid).toBe(true)
  })

  // ── v0.2.0 feature e2e ──

  it('task edit --risk-level and --execution-lane', () => {
    run(['init', 'e2e-edit-sched', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Risky', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'edit', 'U-001', '--risk-level', 'critical', '--execution-lane', 'writer'], dir)
    const doc = readDoc(dir)
    expect(doc.tasks[0].riskLevel).toBe('critical')
    expect(doc.tasks[0].executionLane).toBe('writer')
  })

  it('task edit accepts structured acceptance criteria and execution plan JSON', () => {
    run(['init', 'e2e-edit-structured-fields', '--no-hook'], dir)
    const initialized = readDoc(dir)
    initialized._meta.features.push({
      id: 'f-structured',
      module: 'core',
      name: 'Structured Fields',
      status: 'design',
      specRefs: [],
      dependsOn: [],
      owner: null,
    })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(initialized, null, 2))
    run(['task', 'add', '--json', JSON.stringify([
      {
        name: 'Structured',
        stage: 'S1',
        module: 'core',
        feature: 'f-structured',
        priority: 'P0',
        acceptance: 'ok',
      },
    ])], dir)

    const acceptanceCriteria = {
      requiredTests: ['npm test -w cli'],
      passConditions: ['structured fields are persisted'],
      forbiddenSideEffects: ['no direct tally.json edits'],
      negativeCases: ['invalid JSON is rejected'],
    }
    const executionPlan = {
      inputs: ['task id'],
      outputs: ['updated task'],
      steps: ['parse JSON', 'persist fields', 'run lint'],
    }

    run([
      'task',
      'edit',
      'U-001',
      '--next-action',
      'Use structured fields during round selection',
      '--acceptance-criteria-json',
      JSON.stringify(acceptanceCriteria),
      '--execution-plan-json',
      JSON.stringify(executionPlan),
    ], dir)

    const doc = readDoc(dir)
    expect(doc.tasks[0].acceptanceCriteria).toEqual(acceptanceCriteria)
    expect(doc.tasks[0].executionPlan).toEqual(executionPlan)
    const lintOut = run(['lint', '--json'], dir)
    expect(JSON.parse(lintOut).valid).toBe(true)
  })

  it('task edit rejects malformed structured JSON without writing it', () => {
    run(['init', 'e2e-edit-bad-structured-fields', '--no-hook'], dir)
    const initialized = readDoc(dir)
    initialized._meta.features.push({
      id: 'f-structured',
      module: 'core',
      name: 'Structured Fields',
      status: 'design',
      specRefs: [],
      dependsOn: [],
      owner: null,
    })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(initialized, null, 2))
    run(['task', 'add', '--json', JSON.stringify([
      {
        name: 'Structured',
        stage: 'S1',
        module: 'core',
        feature: 'f-structured',
        priority: 'P0',
        acceptance: 'ok',
      },
    ])], dir)
    run(['task', 'edit', 'U-001', '--next-action', 'Keep the ledger lint-clean before bad edit'], dir)

    const arrayOut = runLaxSafe([
      'task',
      'edit',
      'U-001',
      '--acceptance-criteria-json',
      '[]',
    ], dir)

    expect(arrayOut).toContain('Invalid acceptance criteria')
    const doc = readDoc(dir)
    expect(doc.tasks[0].acceptanceCriteria).toBeNull()

    const nonArrayFieldOut = runLaxSafe([
      'task',
      'edit',
      'U-001',
      '--acceptance-criteria-json',
      JSON.stringify({ requiredTests: 'not-array' }),
    ], dir)
    expect(nonArrayFieldOut).toContain('requiredTests')

    const unknownFieldOut = runLaxSafe([
      'task',
      'edit',
      'U-001',
      '--acceptance-criteria-json',
      JSON.stringify({ unknownField: [] }),
    ], dir)
    expect(unknownFieldOut).toContain('unknown field')

    const badExecutionPlanOut = runLaxSafe([
      'task',
      'edit',
      'U-001',
      '--execution-plan-json',
      JSON.stringify({ steps: [123] }),
    ], dir)
    expect(badExecutionPlanOut).toContain('Invalid execution plan')

    const afterRejectedEdits = readDoc(dir)
    expect(afterRejectedEdits.tasks[0].acceptanceCriteria).toBeNull()
    expect(afterRejectedEdits.tasks[0].executionPlan).toBeNull()
    const lintOut = run(['lint', '--json'], dir)
    expect(JSON.parse(lintOut).valid).toBe(true)
  })

  it('task approve --by', () => {
    run(['init', 'e2e-approve', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Approve Me', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok', riskLevel: 'high' },
    ])], dir)
    run(['task', 'approve', 'U-001', '--by', 'human-reviewer'], dir)
    const doc = readDoc(dir)
    expect(doc.tasks[0].approvedBy).toBe('human-reviewer')
  })

  it('task done with structured evidence', () => {
    run(['init', 'e2e-str-evid', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Evidence Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'done', 'U-001', '--evidence', 'Implemented', '--test', 'npm test', '--commit', 'abc123'], dir)
    const doc = readDoc(dir)
    const done = doc.tasks.find((t: any) => t.evidence?.includes('[test: npm test]'))
    expect(done).toBeTruthy()
    expect(done.evidence).toContain('[commit: abc123]')
  })

  it('graph --level feature outputs feature graph', () => {
    run(['init', 'e2e-fgraph', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'A1', stage: 'S1', module: 'core', feature: 'f-auth', priority: 'P0', acceptance: 'ok' },
      { name: 'A2', stage: 'S1', module: 'core', feature: 'f-auth', priority: 'P0', acceptance: 'ok', deps: ['U-001'] },
      { name: 'B1', stage: 'S1', module: 'core', feature: 'f-core', priority: 'P0', acceptance: 'ok', deps: ['U-001'] },
    ])], dir)
    const out = run(['graph', '--format', 'json', '--level', 'feature'], dir)
    const result = JSON.parse(out)
    expect(result.nodes.length).toBeGreaterThanOrEqual(1)
  })

  it('export --format agent-brief', () => {
    run(['init', 'e2e-abrief', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Brief Task', stage: 'S1', module: 'core', feature: 'f-brief', priority: 'P0', acceptance: 'ok',
        writeScopes: ['src/**'], riskLevel: 'medium', executionLane: 'writer' },
    ])], dir)
    const out = run(['export', '--format', 'agent-brief'], dir)
    expect(out).toContain('Brief Task')
    expect(out).toContain('Write Scopes')
    expect(out).toContain('src/**')
  })

  it('round start --strategy feature-focused', () => {
    run(['init', 'e2e-rstrat', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'F1', stage: 'S1', module: 'core', feature: 'f-a', priority: 'P0', acceptance: 'ok' },
      { name: 'F2', stage: 'S1', module: 'core', feature: 'f-b', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = run(['round', 'start', 'feature-round', '--strategy', 'feature-focused'], dir)
    expect(out).toContain('Round started')
  })

  it('check shows FEATURE_REQUIRED warning for open task without feature', () => {
    run(['init', 'e2e-freq', '--no-hook'], dir)
    const doc = readDoc(dir)
    doc.tasks.push({
      id: 'U-001', status: 'pending', priority: 'P0', stage: 'S1', module: 'core',
      name: 'No Feature', acceptance: 'ok', deps: [], blocks: null,
      nextAction: 'do it', evidence: null, rule: null, feature: null, tags: [],
      order: 1, completedOrder: null, claimedBy: null, claimedAt: null,
      createdAt: '2026-05-15', completedAt: null,
      writeScopes: [], acceptanceCriteria: null, executionPlan: null,
      riskLevel: 'medium', rollbackPlan: null, executionLane: null,
      assignedAgent: null, requiresReview: false, resourceRequirements: [],
      repos: [], deliveryNode: null, approvedBy: null,
    })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(doc, null, 2))
    const out = runLax(['check', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.warnings.some((w: any) => w.code === 'FEATURE_REQUIRED')).toBe(true)
  })

  // ── Error path e2e ──

  it('task approve on done task fails', () => {
    run(['init', 'e2e-approve-done', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Will Be Done', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    run(['task', 'done', 'U-001', '--evidence', 'finished'], dir)
    // After done, task id is D-001 and status is done
    const out = runLax(['task', 'approve', 'D-001', '--by', 'reviewer'], dir)
    expect(out).toContain('already done')
  })

  it('task approve on missing task fails', () => {
    run(['init', 'e2e-approve-missing', '--no-hook'], dir)
    const out = runLax(['task', 'approve', 'U-999', '--by', 'reviewer'], dir)
    expect(out).toContain('not found')
  })

  it('task edit with invalid riskLevel fails', () => {
    run(['init', 'e2e-edit-risk', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Edit Risk', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = runLax(['task', 'edit', 'U-001', '--risk-level', 'extreme'], dir)
    expect(out).toContain('Invalid riskLevel')
  })

  it('task edit with invalid executionLane fails', () => {
    run(['init', 'e2e-edit-lane', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Edit Lane', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)
    const out = runLax(['task', 'edit', 'U-001', '--execution-lane', 'designer'], dir)
    expect(out).toContain('Invalid executionLane')
  })

  it('round start with conflicting writeScopes fails', () => {
    run(['init', 'e2e-write-conflict', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Writer A', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok',
        writeScopes: ['src/shared/**'] },
      { name: 'Writer B', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok',
        writeScopes: ['src/shared/**'] },
    ])], dir)
    const out = runLax(['round', 'start', 'conflict-round', '--tasks', 'U-001', 'U-002'], dir)
    expect(out).toContain('write scope')
  })

  it('round start with unsatisfied deps fails', () => {
    run(['init', 'e2e-unsat-deps', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Depends On Ghost', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok',
        deps: ['U-999'] },
    ])], dir)
    const out = runLax(['round', 'start', 'deps-round', '--tasks', 'U-001'], dir)
    expect(out).toContain('unsatisfied')
  })

  it('export with unknown format fails', () => {
    run(['init', 'e2e-export-bad', '--no-hook'], dir)
    const out = runLax(['export', '--format', 'xml'], dir)
    expect(out).toContain('Unknown format')
  })

  // ── task show with all new fields ──

  it('task show displays all new fields (writeScopes, riskLevel, executionLane, requiresReview, rollbackPlan, repos, deliveryNode, acceptanceCriteria, executionPlan)', () => {
    run(['init', 'e2e-show-all', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([{
      name: 'Full Detail Task',
      stage: 'S1',
      module: 'core',
      priority: 'P0',
      acceptance: 'all fields visible',
      writeScopes: ['src/core/**', 'src/shared/**'],
      riskLevel: 'high',
      executionLane: 'writer',
      requiresReview: true,
      rollbackPlan: 'revert via git',
      repos: ['repo-a'],
      deliveryNode: 'V1',
      acceptanceCriteria: {
        requiredTests: ['unit', 'integration'],
        passConditions: ['no regressions'],
        forbiddenSideEffects: ['no file corruption'],
        negativeCases: ['empty input'],
      },
      executionPlan: {
        inputs: ['task spec'],
        outputs: ['completed module'],
        steps: ['design', 'implement', 'review'],
      },
    }])], dir)

    const out = run(['task', 'show', 'U-001'], dir)
    expect(out).toContain('Full Detail Task')
    expect(out).toContain('Risk:        high')
    expect(out).toContain('Lane:        writer')
    expect(out).toContain('Write Scopes: src/core/**, src/shared/**')
    expect(out).toContain('Repos:       repo-a')
    expect(out).toContain('Delivery:    V1')
    expect(out).toContain('Review:      Yes')
    expect(out).toContain('Rollback:    revert via git')
    expect(out).toContain('unit')
    expect(out).toContain('integration')
    expect(out).toContain('no regressions')
    expect(out).toContain('no file corruption')
    expect(out).toContain('empty input')
    expect(out).toContain('Exec Plan:')
    expect(out).toContain('task spec')
    expect(out).toContain('completed module')
    expect(out).toContain('design')
  })

  // ── task list --json ──

  it('task list --json outputs valid JSON array', () => {
    run(['init', 'e2e-list-json', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'JSON Task 1', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'JSON Task 2', stage: 'S1', module: 'core', priority: 'P1', acceptance: 'ok' },
    ])], dir)

    const out = run(['task', 'list', '--json'], dir)
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
    expect(parsed[0].name).toBe('JSON Task 1')
    expect(parsed[1].name).toBe('JSON Task 2')
  })

  // ── task done with --rule flag ──

  it('task done --rule stores rule on completed task', () => {
    run(['init', 'e2e-done-rule', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Rule Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    run(['task', 'done', 'U-001', '--evidence', 'completed by rule', '--rule', 'custom-rule-check'], dir)
    const doc = readDoc(dir)
    const done = doc.tasks.find((t: any) => t.status === 'done')
    expect(done).toBeTruthy()
    expect(done.rule).toBe('custom-rule-check')
  })

  // ── task block and unblock cycle ──

  it('task block then unblock cycles status correctly', () => {
    run(['init', 'e2e-block-unblock', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Blockable Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    // Block
    run(['task', 'block', 'U-001', '--reason', 'waiting for dependency'], dir)
    let doc = readDoc(dir)
    expect(doc.tasks[0].status).toBe('blocked')
    expect(doc.tasks[0].blocks).toBe('waiting for dependency')

    // Unblock
    run(['task', 'unblock', 'U-001'], dir)
    doc = readDoc(dir)
    expect(doc.tasks[0].status).toBe('pending')
    expect(doc.tasks[0].blocks).toBeNull()
  })

  it('task list --status open returns all non-done tasks', () => {
    run(['init', 'e2e-list-open', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Open Task 1', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Open Task 2', stage: 'S1', module: 'core', priority: 'P1', acceptance: 'ok' },
      { name: 'Open Task 3', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    // Mark one task as done
    run(['task', 'done', 'U-001', '--evidence', 'done'], dir)

    const out = run(['task', 'list', '--status', 'open'], dir)
    expect(out).not.toContain('U-001')
    expect(out).toContain('U-002')
    expect(out).toContain('U-003')
  })

  it('task list --open is shorthand for --status open', () => {
    run(['init', 'e2e-list-open-flag', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Flag Task 1', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Flag Task 2', stage: 'S1', module: 'core', priority: 'P1', acceptance: 'ok' },
    ])], dir)

    // Mark one task as done
    run(['task', 'done', 'U-001', '--evidence', 'done'], dir)

    const out = run(['task', 'list', '--open'], dir)
    expect(out).not.toContain('U-001')
    expect(out).toContain('U-002')
  })

  // ── task list with combined filters ──

  it('task list --module --status filters correctly with combined criteria', () => {
    run(['init', 'e2e-combined-filters', '--no-hook'], dir)
    // Add a second module and stage to _meta so we can create tasks in different modules
    const doc = readDoc(dir)
    doc._meta.modules.push({ id: 'other', name: 'Other' })
    doc._meta.stages.push({ id: 'S4', name: 'Stage 4', modules: ['other'] })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(doc, null, 2))

    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Core Pending', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Core Done', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Other Pending', stage: 'S4', module: 'other', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    // Mark Core Done as done
    run(['task', 'done', 'U-002', '--evidence', 'done'], dir)

    // Filter: module=core + status=pending → should only get U-001
    const out = run(['task', 'list', '--module', 'core', '--status', 'pending'], dir)
    expect(out).toContain('Core Pending')
    expect(out).not.toContain('Core Done')
    expect(out).not.toContain('Other Pending')
  })

  // ── task add rejects empty JSON array ──

  it('task add --json rejects empty array', () => {
    run(['init', 'e2e-empty-add', '--no-hook'], dir)
    const out = runLax(['task', 'add', '--json', '[]'], dir)
    expect(out).toContain('empty')
  })

  // ── round close with no active round ──

  it('round close fails when no active round exists', () => {
    run(['init', 'e2e-round-close-empty', '--no-hook'], dir)
    const out = runLax(['round', 'close'], dir)
    expect(out).toContain('No active round found')
  })

  // ── round report --json ──

  it('round report --json outputs valid JSON', () => {
    run(['init', 'e2e-round-report-json', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Report Task 1', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Report Task 2', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    run(['round', 'start', 'report-round', '--tasks', 'U-001', 'U-002'], dir)
    const out = run(['round', 'report', '--json'], dir)
    const parsed = JSON.parse(out)

    expect(parsed.roundId).toBeTruthy()
    expect(parsed.tasks.length).toBe(2)
    expect(parsed.totalCount).toBe(2)
    expect(parsed.doneCount).toBe(0)
    expect(Array.isArray(parsed.remaining)).toBe(true)
  })

  // ── round report on specific round ID ──

  it('round report on a specific closed round by ID', () => {
    run(['init', 'e2e-round-report-by-id', '--no-hook'], dir)
    run(['task', 'add', '--json', JSON.stringify([
      { name: 'Round1 Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
      { name: 'Round2 Task', stage: 'S1', module: 'core', priority: 'P0', acceptance: 'ok' },
    ])], dir)

    // Start and close round 1
    const round1Out = run(['round', 'start', 'round-one', '--tasks', 'U-001'], dir)
    const round1Id = round1Out.match(/R-\S+/)?.[0]
    expect(round1Id).toBeTruthy()
    run(['task', 'done', 'U-001', '--evidence', 'round1 done'], dir)
    run(['round', 'close'], dir)

    // Start round 2 (makes it the latest round)
    run(['round', 'start', 'round-two', '--tasks', 'U-002'], dir)

    // Report on round 1 by ID (should be completed, not the active round 2)
    const out = run(['round', 'report', '--json', '--round', round1Id!], dir)
    const parsed = JSON.parse(out)

    expect(parsed.roundId).toBe(round1Id)
    expect(parsed.doneCount).toBe(1)
    expect(parsed.totalCount).toBe(1)
  })
})
