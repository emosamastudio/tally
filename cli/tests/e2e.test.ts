import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const CLI = join(__dirname, '..', 'dist', 'index.js')

function run(args: string[], cwd: string): string {
  return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' })
}

/** Run a CLI command that may exit with non-zero code. Returns stdout. */
function runLax(args: string[], cwd: string): string {
  try {
    return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e: any) {
    return e.stdout ?? ''
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
    })
    writeFileSync(join(dir, 'tally.json'), JSON.stringify(doc, null, 2))
    const out = runLax(['check', '--json'], dir)
    const result = JSON.parse(out)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: any) => e.code === 'FEATURE_MODULE_MISMATCH')).toBe(true)
  })
})
