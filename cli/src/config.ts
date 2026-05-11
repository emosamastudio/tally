// cli/src/config.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { homedir } from 'os'
import type { TallyConfig } from './types.js'

const DEFAULTS: TallyConfig = {
  agent: { id: 'main' },
  round: { maxTasks: 10, allowParallel: false },
  lint: { strict: false },
  dashboard: { port: 5173 },
  projects: [],
}

function loadYaml(path: string): Partial<TallyConfig> | null {
  try {
    const raw = readFileSync(path, 'utf-8')
    return parseYaml(raw) as Partial<TallyConfig>
  } catch {
    return null
  }
}

export function loadConfig(cwd: string = process.cwd()): TallyConfig {
  const global = loadYaml(join(homedir(), '.tallyrc.yaml')) ?? {}
  const local = loadYaml(join(cwd, '.tallyrc.yaml')) ?? {}
  const envId = process.env['TALLY_AGENT_ID']

  // Merge projects: local + global, dedup by name
  const localProjects = local.projects ?? []
  const globalProjects = global.projects ?? []
  const mergedProjects = [...localProjects]
  for (const gp of globalProjects) {
    if (!mergedProjects.some((lp) => lp.name === gp.name)) {
      mergedProjects.push(gp)
    }
  }

  const merged: TallyConfig = {
    agent: { id: envId ?? local.agent?.id ?? global.agent?.id ?? DEFAULTS.agent.id },
    round: { ...DEFAULTS.round, ...global.round, ...local.round },
    lint: { ...DEFAULTS.lint, ...global.lint, ...local.lint },
    dashboard: { ...DEFAULTS.dashboard, ...global.dashboard, ...local.dashboard },
    projects: mergedProjects.length > 0 ? mergedProjects : DEFAULTS.projects,
  }
  return merged
}
