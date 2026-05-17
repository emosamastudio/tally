import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import type { ModuleEntry, TallyDocument } from '../types.js'
import { wrapAction } from './task.js'

function requireNonEmpty(label: string, value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Invalid module ${label}: must not be empty`)
  }
  return normalized
}

export function addModule(doc: TallyDocument, module: ModuleEntry): ModuleEntry {
  module.id = requireNonEmpty('id', module.id)
  module.name = requireNonEmpty('name', module.name)

  if (doc._meta.modules.some((existing) => existing.id === module.id)) {
    throw new Error(`Module "${module.id}" already exists`)
  }

  doc._meta.modules.push(module)
  return module
}

export function moduleCommand(): Command {
  const cmd = new Command('module')
  cmd.description('Module registry operations')

  cmd.command('add')
    .description('Register a module in _meta.modules')
    .argument('<id>', 'Module ID')
    .requiredOption('--name <name>', 'Module display name')
    .option('--json-output', 'Output errors as JSON')
    .action((id: string, opts: Record<string, string | boolean | undefined>) => {
      wrapAction({ json: opts.jsonOutput }, () => {
        const doc = readLedger()
        const module = addModule(doc, {
          id: id.trim(),
          name: (opts.name as string).trim(),
        })
        writeLedger(doc)
        console.log(`Registered module ${module.id}: ${module.name}`)
      })
    })

  cmd.command('list')
    .description('List registered modules')
    .option('--json', 'Output JSON')
    .action((opts: { json?: boolean }) => {
      wrapAction({ json: opts.json }, () => {
        const doc = readLedger()
        if (opts.json) {
          console.log(JSON.stringify(doc._meta.modules, null, 2))
          return
        }
        if (doc._meta.modules.length === 0) {
          console.log('(no modules)')
          return
        }
        for (const module of doc._meta.modules) {
          console.log(`${module.id}\t${module.name}`)
        }
      })
    })

  return cmd
}
