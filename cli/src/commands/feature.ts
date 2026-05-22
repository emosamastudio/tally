import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import { writeLedger } from '../ledger-writer.js'
import type { FeatureEntry, FeatureStatus, TallyDocument } from '../types.js'
import { wrapAction } from './task.js'

function parseList(raw: string | undefined): string[] {
  return raw === undefined
    ? []
    : [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))]
}

function requireNonEmpty(label: string, value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Invalid feature ${label}: must not be empty`)
  }
  return normalized
}

export function addFeature(
  doc: TallyDocument,
  feature: FeatureEntry,
): FeatureEntry {
  feature.id = requireNonEmpty('id', feature.id)
  feature.module = requireNonEmpty('module', feature.module)
  feature.name = requireNonEmpty('name', feature.name)
  feature.owner = feature.owner === null ? null : requireNonEmpty('owner', feature.owner)

  if (!doc._meta.modules.some((module) => module.id === feature.module)) {
    throw new Error(`Module "${feature.module}" not found in _meta.modules`)
  }
  if (doc._meta.features.some((existing) => existing.id === feature.id)) {
    throw new Error(`Feature "${feature.id}" already exists`)
  }
  for (const dep of feature.dependsOn) {
    if (!doc._meta.features.some((existing) => existing.id === dep)) {
      throw new Error(`Feature dependency "${dep}" not found in _meta.features`)
    }
  }

  doc._meta.features.push(feature)
  return feature
}

function requireFeature(doc: TallyDocument, id: string): FeatureEntry {
  const normalizedId = requireNonEmpty('id', id)
  const feature = doc._meta.features.find((existing) => existing.id === normalizedId)
  if (!feature) {
    throw new Error(`Feature "${normalizedId}" not found in _meta.features`)
  }
  return feature
}

function validateFeatureDependencies(doc: TallyDocument, featureId: string, deps: string[]): void {
  if (deps.includes(featureId)) {
    throw new Error(`Invalid feature dependsOn: feature "${featureId}" cannot depend on itself`)
  }
  for (const dep of deps) {
    if (!doc._meta.features.some((existing) => existing.id === dep)) {
      throw new Error(`Feature dependency "${dep}" not found in _meta.features`)
    }
  }
}

export function editFeature(
  doc: TallyDocument,
  id: string,
  updates: Partial<Pick<FeatureEntry, 'name' | 'status' | 'specRefs' | 'dependsOn' | 'owner'>>,
): FeatureEntry {
  const feature = requireFeature(doc, id.trim())

  if (updates.name !== undefined) {
    feature.name = requireNonEmpty('name', updates.name)
  }
  if (updates.status !== undefined) {
    feature.status = updates.status
  }
  if (updates.specRefs !== undefined) {
    feature.specRefs = updates.specRefs
  }
  if (updates.dependsOn !== undefined) {
    validateFeatureDependencies(doc, feature.id, updates.dependsOn)
    feature.dependsOn = updates.dependsOn
  }
  if (updates.owner !== undefined) {
    feature.owner = updates.owner === null ? null : requireNonEmpty('owner', updates.owner)
  }

  return feature
}

export function featureCommand(): Command {
  const cmd = new Command('feature')
  cmd.description('Feature registry operations')

  cmd.command('add')
    .description('Register a feature in _meta.features')
    .argument('<id>', 'Feature ID')
    .requiredOption('--module <module>', 'Module ID')
    .requiredOption('--name <name>', 'Feature display name')
    .option('--status <status>', 'Feature status: design, contract_frozen, implementing, stable', 'design')
    .option('--spec-refs <refs>', 'Comma-separated spec references')
    .option('--depends-on <featureIds>', 'Comma-separated feature dependencies')
    .option('--owner <owner>', 'Feature owner')
    .option('--json-output', 'Output errors as JSON')
    .action((id: string, opts: Record<string, string | boolean | undefined>) => {
      wrapAction({ json: opts.jsonOutput }, () => {
        const status = opts.status as string
        if (!['design', 'contract_frozen', 'implementing', 'stable'].includes(status)) {
          throw new Error(`Invalid feature status "${status}"`)
        }

        const doc = readLedger()
        const owner = typeof opts.owner === 'string' ? opts.owner.trim() : ''
        const feature = addFeature(doc, {
          id: id.trim(),
          module: (opts.module as string).trim(),
          name: (opts.name as string).trim(),
          status: status as FeatureStatus,
          specRefs: parseList(opts.specRefs as string | undefined),
          dependsOn: parseList(opts.dependsOn as string | undefined),
          owner: owner === '' ? null : owner,
        })
        writeLedger(doc)
        console.log(`Registered feature ${feature.id}: ${feature.name}`)
      })
    })

  cmd.command('edit')
    .description('Update mutable feature metadata in _meta.features')
    .argument('<id>', 'Feature ID')
    .option('--name <name>', 'Feature display name')
    .option('--status <status>', 'Feature status: design, contract_frozen, implementing, stable')
    .option('--spec-refs <refs>', 'Comma-separated spec references')
    .option('--depends-on <featureIds>', 'Comma-separated feature dependencies')
    .option('--owner <owner>', 'Feature owner')
    .option('--json-output', 'Output errors as JSON')
    .action((id: string, opts: Record<string, string | boolean | undefined>) => {
      wrapAction({ json: opts.jsonOutput }, () => {
        const status = opts.status as string | undefined
        if (status !== undefined && !['design', 'contract_frozen', 'implementing', 'stable'].includes(status)) {
          throw new Error(`Invalid feature status "${status}"`)
        }

        const doc = readLedger()
        const updates: Partial<Pick<FeatureEntry, 'name' | 'status' | 'specRefs' | 'dependsOn' | 'owner'>> = {}
        if (typeof opts.name === 'string') {
          updates.name = opts.name.trim()
        }
        if (status !== undefined) {
          updates.status = status as FeatureStatus
        }
        if (opts.specRefs !== undefined) {
          updates.specRefs = parseList(opts.specRefs as string | undefined)
        }
        if (opts.dependsOn !== undefined) {
          updates.dependsOn = parseList(opts.dependsOn as string | undefined)
        }
        if (opts.owner !== undefined) {
          const owner = typeof opts.owner === 'string' ? opts.owner.trim() : ''
          updates.owner = owner === '' ? null : owner
        }

        const feature = editFeature(doc, id, updates)
        writeLedger(doc)
        console.log(`Updated feature ${feature.id}: ${feature.name}`)
      })
    })

  cmd.command('list')
    .description('List registered features')
    .option('--json', 'Output JSON')
    .action((opts: { json?: boolean }) => {
      wrapAction({ json: opts.json }, () => {
        const doc = readLedger()
        if (opts.json) {
          console.log(JSON.stringify(doc._meta.features, null, 2))
          return
        }
        if (doc._meta.features.length === 0) {
          console.log('(no features)')
          return
        }
        for (const feature of doc._meta.features) {
          console.log(`${feature.id}\t${feature.module}\t${feature.status}\t${feature.name}`)
        }
      })
    })

  return cmd
}
