// cli/tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { loadConfig } from '../src/config.js'
import type { TallyConfig } from '../src/types.js'

// Mock os.homedir so we can redirect global config to a temp dir.
// The arrow function captures the variable at call time, so we can
// assign it in beforeEach before loadConfig runs.
let mockHomeDir = ''

vi.mock('os', () => ({
  homedir: () => mockHomeDir,
}))

describe('config - defaults', () => {
  let homeDir: string
  let cwd: string

  beforeEach(() => {
    homeDir = mkdtempSync('/tmp/tally-config-home-')
    cwd = mkdtempSync('/tmp/tally-config-cwd-')
    mockHomeDir = homeDir
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
    delete process.env['TALLY_AGENT_ID']
  })

  it('default config includes gates section with correct defaults', () => {
    const config = loadConfig(cwd)
    expect(config.gates).toBeDefined()
    expect(config.gates.requireFeature).toBe(true)
    expect(config.gates.requireReview).toBe(false)
    expect(config.gates.featureFreeze).toEqual([])
    expect(config.gates.maxRisk).toBe('high')
    expect(config.gates.detectWriteConflicts).toBe(true)
  })

  it('default config includes agent, round, lint, dashboard defaults', () => {
    const config = loadConfig(cwd)
    expect(config.agent.id).toBe('main')
    expect(config.round.maxTasks).toBe(10)
    expect(config.round.allowParallel).toBe(false)
    expect(config.lint.strict).toBe(false)
    expect(config.dashboard.port).toBe(5173)
    expect(config.projects).toEqual([])
  })
})

describe('config - merge', () => {
  let homeDir: string
  let cwd: string

  beforeEach(() => {
    homeDir = mkdtempSync('/tmp/tally-config-global-')
    cwd = mkdtempSync('/tmp/tally-config-local-')
    mockHomeDir = homeDir
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
    delete process.env['TALLY_AGENT_ID']
  })

  it('merges gates from local .tallyrc.yaml over defaults', () => {
    writeFileSync(
      join(cwd, '.tallyrc.yaml'),
      `gates:
  requireReview: true
  maxRisk: critical
  featureFreeze:
    - auth
    - payments
  detectWriteConflicts: false
`,
    )
    const config = loadConfig(cwd)
    expect(config.gates.requireFeature).toBe(true) // from defaults (not overridden)
    expect(config.gates.requireReview).toBe(true) // from local
    expect(config.gates.maxRisk).toBe('critical') // from local
    expect(config.gates.featureFreeze).toEqual(['auth', 'payments']) // from local
    expect(config.gates.detectWriteConflicts).toBe(false) // from local
  })

  it('merges gates from global .tallyrc.yaml over defaults', () => {
    writeFileSync(
      join(homeDir, '.tallyrc.yaml'),
      `gates:
  requireReview: true
  maxRisk: medium
`,
    )
    const config = loadConfig(cwd)
    expect(config.gates.requireFeature).toBe(true) // default
    expect(config.gates.requireReview).toBe(true) // global
    expect(config.gates.maxRisk).toBe('medium') // global
  })

  it('local gates override global gates', () => {
    writeFileSync(
      join(homeDir, '.tallyrc.yaml'),
      `gates:
  requireReview: true
  maxRisk: medium
`,
    )
    writeFileSync(
      join(cwd, '.tallyrc.yaml'),
      `gates:
  maxRisk: critical
`,
    )
    const config = loadConfig(cwd)
    // local maxRisk (critical) overrides global (medium)
    expect(config.gates.maxRisk).toBe('critical')
    // local didn't set requireReview, so global (true) applies
    expect(config.gates.requireReview).toBe(true)
  })

  it('TALLY_AGENT_ID env var overrides agent.id', () => {
    process.env['TALLY_AGENT_ID'] = 'bot-42'
    const config = loadConfig(cwd)
    expect(config.agent.id).toBe('bot-42')
  })

  it('TALLY_AGENT_ID overrides local and global agent.id', () => {
    process.env['TALLY_AGENT_ID'] = 'env-agent'
    writeFileSync(join(homeDir, '.tallyrc.yaml'), 'agent:\n  id: global-agent\n')
    writeFileSync(join(cwd, '.tallyrc.yaml'), 'agent:\n  id: local-agent\n')
    const config = loadConfig(cwd)
    expect(config.agent.id).toBe('env-agent')
  })

  it('local agent.id overrides global when no env var set', () => {
    writeFileSync(join(homeDir, '.tallyrc.yaml'), 'agent:\n  id: global-agent\n')
    writeFileSync(join(cwd, '.tallyrc.yaml'), 'agent:\n  id: local-agent\n')
    const config = loadConfig(cwd)
    expect(config.agent.id).toBe('local-agent')
  })
})

describe('config - round merge (local > global > defaults)', () => {
  let homeDir: string
  let cwd: string

  beforeEach(() => {
    homeDir = mkdtempSync('/tmp/tally-config-round-')
    cwd = mkdtempSync('/tmp/tally-config-round-cwd-')
    mockHomeDir = homeDir
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
    delete process.env['TALLY_AGENT_ID']
  })

  it('round defaults are used when no config files exist', () => {
    const config = loadConfig(cwd)
    expect(config.round.maxTasks).toBe(10)
    expect(config.round.allowParallel).toBe(false)
  })

  it('global round config overrides defaults', () => {
    writeFileSync(
      join(homeDir, '.tallyrc.yaml'),
      `round:
  maxTasks: 5
  allowParallel: true
`,
    )
    const config = loadConfig(cwd)
    expect(config.round.maxTasks).toBe(5) // global overrides default 10
    expect(config.round.allowParallel).toBe(true) // global overrides default false
  })

  it('local round config overrides global overrides defaults', () => {
    writeFileSync(
      join(homeDir, '.tallyrc.yaml'),
      `round:
  maxTasks: 5
  allowParallel: true
`,
    )
    writeFileSync(
      join(cwd, '.tallyrc.yaml'),
      `round:
  maxTasks: 3
`,
    )
    const config = loadConfig(cwd)
    expect(config.round.maxTasks).toBe(3) // local overrides global 5
    expect(config.round.allowParallel).toBe(true) // not set in local, falls through to global
  })
})

describe('config - project merge', () => {
  let homeDir: string
  let cwd: string

  beforeEach(() => {
    homeDir = mkdtempSync('/tmp/tally-config-proj-')
    cwd = mkdtempSync('/tmp/tally-config-proj-cwd-')
    mockHomeDir = homeDir
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
  })

  it('local projects take precedence and global projects dedupe by name', () => {
    writeFileSync(
      join(homeDir, '.tallyrc.yaml'),
      `projects:
  - name: proj-a
    path: /home/a
  - name: proj-b
    path: /home/b
`,
    )
    writeFileSync(
      join(cwd, '.tallyrc.yaml'),
      `projects:
  - name: proj-b
    path: /local/b
  - name: proj-c
    path: /local/c
`,
    )
    const config = loadConfig(cwd)
    expect(config.projects).toHaveLength(3)
    expect(config.projects).toContainEqual({ name: 'proj-b', path: '/local/b' }) // local wins
    expect(config.projects).toContainEqual({ name: 'proj-c', path: '/local/c' })
    expect(config.projects).toContainEqual({ name: 'proj-a', path: '/home/a' }) // global non-duplicate
  })
})
