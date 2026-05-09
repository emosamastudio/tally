import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const CLI = join(__dirname, '..', 'dist', 'index.js')

function run(args: string[], cwd: string): string {
  return execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' })
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
})
