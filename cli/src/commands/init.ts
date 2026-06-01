import { Command } from 'commander'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { TallyDocument } from '../types.js'
import { ensureParentDir, resolveLedgerPath, resolveLocalConfigPath } from '../paths.js'

const TEMPLATE: TallyDocument = {
  _meta: {
    project: '',
    tally_version: '1.0',
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString().slice(0, 10),
    agents: [{ id: 'main', name: '主会话' }],
    stages: [
      { id: 'S1', name: 'Stage 1', modules: ['core'] },
      { id: 'S2', name: 'Stage 2', modules: ['core'] },
      { id: 'S3', name: 'Stage 3', modules: ['core'] },
    ],
    modules: [
      { id: 'core', name: 'Core' },
    ],
    features: [],
    plans: [],
  },
  tasks: [],
  rounds: [],
  blocks: [],
  progress: [],
}

function installPreCommitHook(cwd: string): void {
  const hooksDir = join(cwd, '.git', 'hooks')
  if (!existsSync(hooksDir)) return
  const hookPath = join(hooksDir, 'pre-commit')
  if (existsSync(hookPath)) {
    console.log('pre-commit hook already exists, skipping')
    return
  }
  writeFileSync(hookPath, '#!/bin/sh\nnpx tally check --strict\n', { mode: 0o755 })
  console.log('pre-commit hook installed (.git/hooks/pre-commit) — runs tally check --strict')
}

function registerProject(cwd: string, projectName: string): void {
  const rcPath = resolveLocalConfigPath(cwd)
  ensureParentDir(rcPath)
  let config: Record<string, unknown> = {}

  if (existsSync(rcPath)) {
    try {
      const raw = readFileSync(rcPath, 'utf-8')
      config = (parseYaml(raw) as Record<string, unknown>) ?? {}
    } catch {
      // Corrupt config — start fresh
    }
  } else {
    // Create new config with full defaults
    config = {
      agent: { id: 'main' },
      round: { maxTasks: 10, allowParallel: false },
      lint: { strict: false },
      dashboard: { port: 5173 },
      projects: [],
    }
  }

  const projects = (config['projects'] as Array<{ name: string; path: string }>) ?? []
  const alreadyRegistered = projects.some((p) => p.path === cwd || p.name === projectName)
  if (alreadyRegistered) {
    console.log(`Project "${projectName}" already registered in ${rcPath}`)
    return
  }

  projects.push({ name: projectName, path: cwd })
  config['projects'] = projects

  writeFileSync(rcPath, stringifyYaml(config), 'utf-8')
  console.log(`Project "${projectName}" registered in ${rcPath}`)
}

export function initCommand(): Command {
  const cmd = new Command('init')
  cmd.description('Initialize a new .tally/tally.json ledger in the current directory')
    .argument('[name]', 'Project name', 'my-project')
    .option('--no-hook', 'Skip pre-commit hook installation')
    .option('--no-register', 'Skip registering project in .tally/config.yaml')
    .action((name: string, opts: { hook: boolean; register: boolean }) => {
      const cwd = process.cwd()
      const path = resolveLedgerPath(cwd)
      if (existsSync(path)) {
        console.error(`Tally ledger already exists at ${path}`)
        process.exit(1)
      }
      const doc = { ...TEMPLATE }
      doc._meta = { ...doc._meta, project: name }
      ensureParentDir(path)
      writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
      const configPath = resolveLocalConfigPath(cwd)
      ensureParentDir(configPath)
      if (!existsSync(configPath)) {
        writeFileSync(configPath, stringifyYaml({
          agent: { id: 'main' },
          round: { maxTasks: 10, allowParallel: false },
          lint: { strict: false },
          dashboard: { port: 5173 },
          projects: [],
          gates: {
            requireFeature: true,
            requireReview: false,
            featureFreeze: [],
            maxRisk: 'high',
            detectWriteConflicts: true,
          },
        }), 'utf-8')
      }
      console.log(`Created Tally ledger for "${name}" at ${path}`)
      if (opts.hook) installPreCommitHook(cwd)
      if (opts.register) registerProject(cwd, name)
    })
  return cmd
}
