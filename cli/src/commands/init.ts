import { Command } from 'commander'
import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { TallyDocument } from '../types.js'

const TEMPLATE: TallyDocument = {
  _meta: {
    project: '',
    tally_version: '1.0',
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString().slice(0, 10),
    agents: [{ id: 'main', name: '主会话' }],
    stages: [],
    modules: [],
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

export function initCommand(): Command {
  const cmd = new Command('init')
  cmd.description('Initialize a new tally.json in the current directory')
    .argument('[name]', 'Project name', 'my-project')
    .option('--no-hook', 'Skip pre-commit hook installation')
    .action((name: string, opts: { hook: boolean }) => {
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
    })
  return cmd
}
