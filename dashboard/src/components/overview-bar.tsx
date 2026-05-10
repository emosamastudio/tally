// src/components/overview-bar.tsx
import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import type { LedgerData, Task } from '@/lib/types'

interface OverviewBarProps {
  data: LedgerData['merged']
  tasks: Task[]
  modules: LedgerData['modules']
}

const TILTS = [1, 2, 3, 1, 2] as const

function StatTile({ label, value, hint, tilt }: { label: string; value: string; hint?: string; tilt?: number }) {
  return (
    <Card tilt={tilt as 1 | 2 | 3 | undefined} className="px-3 py-2 md:px-4 md:py-3" style={{ minWidth: 0, overflow: 'hidden' }}>
      <div className="sk-label truncate">{label}</div>
      <div className="sk-num truncate" style={{ marginTop: 4, fontSize: 40 }}>
        {value}
      </div>
      {hint && <div className="sk-body truncate" style={{ marginTop: 2, fontSize: 11, color: 'var(--ink-3)' }}>{hint}</div>}
    </Card>
  )
}

export default function OverviewBar({ data, tasks, modules }: OverviewBarProps) {
  const progress = data.totalDone + data.totalOpen > 0
    ? Math.round((data.totalDone / (data.totalDone + data.totalOpen)) * 100)
    : 0

  const blockingCount = data.activeBlocks.length

  const moduleStats = useMemo(() => {
    const groups = new Map<string, { name: string; total: number; done: number }>()
    for (const t of tasks) {
      const modId = t.module || t.stage
      if (!groups.has(modId)) {
        const modMeta = modules.find((m) => m.id === modId)
        groups.set(modId, { name: modMeta?.name ?? modId, total: 0, done: 0 })
      }
      const g = groups.get(modId)!
      g.total++
      if (t.status === 'completed') g.done++
    }
    return [...groups.entries()].map(([id, g]) => ({ id, name: g.name, total: g.total, done: g.done }))
  }, [tasks, modules])

  return (
    <div className="space-y-3">
      {/* KPI strip: 5 stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="已完成" value={String(data.totalDone)} hint={`总计 ${data.totalDone + data.totalOpen}`} tilt={TILTS[0]} />
        <StatTile label="未完成" value={String(data.totalOpen)} hint={`${blockingCount} 阻塞`} tilt={TILTS[1]} />
        <StatTile label="完成率" value={`${progress}%`} hint="目标 80%" tilt={TILTS[2]} />
        <StatTile label="活跃回合" value={data.activeRound?.id ?? '—'} hint={data.activeRound ? '进行中' : '无'} tilt={TILTS[3]} />
        <StatTile label="阻塞项" value={String(blockingCount)} hint={blockingCount > 0 ? '需关注' : '无阻塞'} tilt={TILTS[4]} />
      </div>

      {/* Module chips row */}
      {moduleStats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="sk-label" style={{ fontSize: 11 }}>模块</span>
          {moduleStats.map((m) => {
            const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0
            const isDone = m.done === m.total && m.total > 0
            const isPartial = m.done > 0 && m.done < m.total
            return (
              <span
                key={m.id}
                className={`sk-chip ${isDone ? 'ok' : isPartial ? 'accent' : ''}`}
                style={{ fontSize: 11 }}
                title={`${m.name}: ${m.done}/${m.total}`}
              >
                {m.name} <span style={{ color: 'var(--ink-3)' }}>{pct}%</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function OverviewBarSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="sk-box" style={{ padding: '12px 14px', minWidth: 0 }}>
            <span className="sk-bar dark" style={{ width: 50, height: 6 }} />
            <div style={{ marginTop: 6 }}>
              <span className="sk-bar" style={{ width: '60%', height: 38 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="sk-chip" style={{ opacity: 0.5 }}>
            <span className="sk-bar dark" style={{ width: 40, height: 5 }} />
          </span>
        ))}
      </div>
    </div>
  )
}
