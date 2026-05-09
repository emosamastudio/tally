import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import type { StatusResult, Task, TallyDocument } from '../types.js'

function computeStatus(doc: TallyDocument): StatusResult {
  const tasks = doc.tasks
  const done = tasks.filter((t: Task) => t.status === 'done').length
  const hold = tasks.filter((t: Task) => t.status === 'hold').length
  const blocked = tasks.filter((t: Task) => t.status === 'blocked').length
  const open = tasks.filter((t: Task) => !['done', 'hold'].includes(t.status)).length
  const activeRound = doc.rounds.find((r) => r.status === 'active')
  return {
    totalDone: done,
    totalOpen: open,
    totalHold: hold,
    totalBlocked: blocked,
    activeRoundId: activeRound?.id ?? null,
    activeBlocks: doc.blocks.filter((b) => b.resolvedAt === null).length,
  }
}

export function statusCommand(): Command {
  const cmd = new Command('status')
  cmd.description('Show one-line ledger summary')
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
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
