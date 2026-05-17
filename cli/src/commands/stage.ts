import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import type { StageEntry, TallyDocument } from '../types.js'
import { wrapAction } from './task.js'

function parseList(raw: string | undefined): string[] {
  return raw === undefined
    ? []
    : [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))]
}

function requireNonEmpty(label: string, value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Invalid stage ${label}: must not be empty`)
  }
  return normalized
}

export function addStage(doc: TallyDocument, stage: StageEntry): StageEntry {
  stage.id = requireNonEmpty('id', stage.id)
  stage.name = requireNonEmpty('name', stage.name)

  if (stage.modules.length === 0) {
    throw new Error('Invalid stage modules: must include at least one module')
  }
  if (doc._meta.stages.some((existing) => existing.id === stage.id)) {
    throw new Error(`Stage "${stage.id}" already exists`)
  }
  for (const moduleId of stage.modules) {
    if (!doc._meta.modules.some((module) => module.id === moduleId)) {
      throw new Error(`Stage module "${moduleId}" not found in _meta.modules`)
    }
  }

  doc._meta.stages.push(stage)
  return stage
}

export function stageCommand(): Command {
  const cmd = new Command('stage')
  cmd.description('Stage registry operations')

  cmd.command('add')
    .description('Register a stage in _meta.stages')
    .argument('<id>', 'Stage ID')
    .requiredOption('--name <name>', 'Stage display name')
    .requiredOption('--modules <modules>', 'Comma-separated module IDs')
    .option('--json-output', 'Output errors as JSON')
    .action((id: string, opts: Record<string, string | boolean | undefined>) => {
      wrapAction({ json: opts.jsonOutput }, () => {
        const doc = readLedger()
        const stage = addStage(doc, {
          id: id.trim(),
          name: (opts.name as string).trim(),
          modules: parseList(opts.modules as string | undefined),
        })
        writeLedger(doc)
        console.log(`Registered stage ${stage.id}: ${stage.name}`)
      })
    })

  cmd.command('list')
    .description('List registered stages')
    .option('--json', 'Output JSON')
    .action((opts: { json?: boolean }) => {
      wrapAction({ json: opts.json }, () => {
        const doc = readLedger()
        if (opts.json) {
          console.log(JSON.stringify(doc._meta.stages, null, 2))
          return
        }
        if (doc._meta.stages.length === 0) {
          console.log('(no stages)')
          return
        }
        for (const stage of doc._meta.stages) {
          console.log(`${stage.id}\t${stage.modules.join(',')}\t${stage.name}`)
        }
      })
    })

  return cmd
}
