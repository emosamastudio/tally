import { Command } from 'commander'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { TallyDocument } from '../types.js'

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
  writeFileSync(hookPath, '#!/bin/sh\nnpx tally lint --strict\n', { mode: 0o755 })
  console.log('pre-commit hook installed (.git/hooks/pre-commit)')
}

function registerProject(cwd: string, projectName: string): void {
  const rcPath = join(cwd, '.tallyrc.yaml')
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
    console.log(`Project "${projectName}" already registered in .tallyrc.yaml`)
    return
  }

  projects.push({ name: projectName, path: cwd })
  config['projects'] = projects

  writeFileSync(rcPath, stringifyYaml(config), 'utf-8')
  console.log(`Project "${projectName}" registered in .tallyrc.yaml`)
}

export function initCommand(): Command {
  const cmd = new Command('init')
  cmd.description('Initialize a new tally.json in the current directory')
    .argument('[name]', 'Project name', 'my-project')
    .option('--no-hook', 'Skip pre-commit hook installation')
    .option('--no-register', 'Skip registering project in .tallyrc.yaml')
    .action((name: string, opts: { hook: boolean; register: boolean }) => {
      const cwd = process.cwd()
      const path = join(cwd, 'tally.json')
      if (existsSync(path)) {
        console.error(`tally.json already exists at ${path}`)
        process.exit(1)
      }
      const doc = { ...TEMPLATE }
      doc._meta = { ...doc._meta, project: name }
      writeFileSync(path, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
      console.log(`Created tally.json for "${name}" at ${path}`)
      if (opts.hook) installPreCommitHook(cwd)
      if (opts.register) registerProject(cwd, name)
    })
  return cmd
}
