import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import type { StatusResult, FeatureBreakdown, ActiveRoundInfo, DeliveryNodeInfo, TallyDocument } from '../types.js'

function computeStatus(doc: TallyDocument): StatusResult {
  const tasks = doc.tasks
  const done = tasks.filter((t) => t.status === 'done').length
  const hold = tasks.filter((t) => t.status === 'hold').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const open = tasks.filter((t) => !['done', 'hold'].includes(t.status)).length
  const activeRound = doc.rounds.find((r) => r.status === 'active')

  // Feature breakdown
  const featMap = new Map<string, FeatureBreakdown>()
  for (const t of tasks) {
    const fid = t.feature ?? '__none__'
    if (!featMap.has(fid)) {
      const feat = doc._meta.features.find((f) => f.id === fid)
      featMap.set(fid, {
        feature: fid,
        module: feat?.module ?? t.module,
        name: feat?.name ?? fid,
        total: 0, done: 0, blocked: 0, inProgress: 0,
      })
    }
    const fb = featMap.get(fid)!
    fb.total++
    if (t.status === 'done') fb.done++
    else if (t.status === 'blocked') fb.blocked++
    else if (t.status === 'in_progress') fb.inProgress++
  }
  const features = [...featMap.values()].sort((a, b) => b.total - a.total)

  // Active rounds
  const activeRounds: ActiveRoundInfo[] = doc.rounds
    .filter((r) => r.status === 'active')
    .map((r) => {
      const taskDetails = r.plannedTasks.map((pt) => {
        const task = tasks.find((t) => t.id === pt.taskId || t.id === pt.taskId.replace(/^[UD]-/, 'U-') || t.id === pt.taskId.replace(/^[UD]-/, 'D-'))
        return task?.status ?? 'unknown'
      })
      return {
        roundId: r.id,
        executor: r.executor,
        scope: r.scope,
        taskCount: r.plannedTasks.length,
        doneCount: taskDetails.filter((s) => s === 'done').length,
      }
    })

  // Delivery node breakdown
  const nodeMap = new Map<string, { total: number; done: number; blocked: number }>()
  for (const t of tasks) {
    const node = t.deliveryNode || '__none__'
    if (!nodeMap.has(node)) nodeMap.set(node, { total: 0, done: 0, blocked: 0 })
    const nd = nodeMap.get(node)!
    nd.total++
    if (t.status === 'done') nd.done++
    else if (t.status === 'blocked') nd.blocked++
  }
  const deliveryNodes: DeliveryNodeInfo[] = [...nodeMap.entries()]
    .map(([node, nd]) => ({ node, ...nd }))
    .sort((a, b) => a.node.localeCompare(b.node))

  return {
    totalDone: done,
    totalOpen: open,
    totalHold: hold,
    totalBlocked: blocked,
    activeRoundId: activeRound?.id ?? null,
    activeBlocks: doc.blocks.filter((b) => b.resolvedAt === null).length,
    features,
    activeRounds,
    deliveryNodes,
  }
}

export function statusCommand(): Command {
  const cmd = new Command('status')
  cmd.description('Show ledger summary with feature breakdown and active rounds')
    .option('--json', 'Output JSON')
    .action((opts: { json: boolean }) => {
      try {
        const doc = readLedger()
        const s = computeStatus(doc)
        if (opts.json) {
          console.log(JSON.stringify(s, null, 2))
        } else {
          console.log(
            `DONE ${s.totalDone} / OPEN ${s.totalOpen} / HOLD ${s.totalHold} / ` +
            `BLOCKED ${s.totalBlocked} / ROUND ${s.activeRoundId ?? 'none'} / ` +
            `BLOCKS ${s.activeBlocks}`,
          )
          if (s.activeRounds.length > 0) {
            console.log('')
            console.log('Active rounds:')
            for (const ar of s.activeRounds) {
              console.log(`  ${ar.roundId} [${ar.executor}] ${ar.scope} — ${ar.doneCount}/${ar.taskCount} done`)
            }
          }
          if (s.features.length > 0) {
            console.log('')
            console.log('Features:')
            for (const f of s.features.slice(0, 10)) {
              const pct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0
              const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
              const label = f.feature === '__none__' ? '(no feature)' : f.feature
              console.log(`  ${bar} ${pct}% ${label} [${f.module}] ${f.done}/${f.total}${f.blocked > 0 ? ` BLOCKED:${f.blocked}` : ''}`)
            }
            if (s.features.length > 10) {
              console.log(`  ... and ${s.features.length - 10} more features`)
            }
          }
          if (s.deliveryNodes.length > 0 && s.deliveryNodes.some((d) => d.node !== '__none__')) {
            console.log('')
            console.log('Delivery nodes:')
            for (const d of s.deliveryNodes) {
              const label = d.node === '__none__' ? '(no milestone)' : d.node
              const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0
              console.log(`  ${label}: ${d.done}/${d.total} done${d.blocked > 0 ? ` (${d.blocked} blocked)` : ''} — ${pct}%`)
            }
          }
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
