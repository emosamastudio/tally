// src/components/distribution-panel.tsx
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Treemap } from 'recharts'
import type { Task, Priority } from '@/lib/types'

interface DistributionPanelProps {
  tasks: Task[]
}

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: 'var(--danger)',
  P1: 'var(--accent)',
  P2: 'var(--ink-3)',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'P0', P1: 'P1', P2: 'P2',
}

export default function DistributionPanel({ tasks }: DistributionPanelProps) {
  const priorityData = useMemo(() => {
    const counts: Record<Priority, number> = { P0: 0, P1: 0, P2: 0 }
    for (const t of tasks) counts[t.priority]++
    return (Object.entries(counts) as [Priority, number][])
      .map(([p, v]) => ({ name: PRIORITY_LABEL[p], value: v, priority: p }))
      .filter((d) => d.value > 0)
  }, [tasks])

  const moduleData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; done: number }>()
    for (const t of tasks) {
      const m = t.module || '?'
      if (!map.has(m)) map.set(m, { name: m, total: 0, done: 0 })
      const e = map.get(m)!
      e.total++
      if (t.status === 'completed') e.done++
    }
    return Array.from(map.values()).map((e) => ({
      name: e.name,
      size: e.total,
      ratio: e.total > 0 ? e.done / e.total : 0,
    }))
  }, [tasks])

  const total = tasks.length

  if (total === 0) {
    return (
      <Card>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0' }}>
            无任务数据
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 16px' }}>
        <h3 className="sk-h3">任务分布</h3>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {total} 任务 · {priorityData.length} 优先级 · {moduleData.length} 模块
        </span>
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderTop: '1.6px dashed var(--ink-4)' }}>
          {/* Priority donut — left */}
          <div style={{ padding: '8px 4px 8px 12px', borderRight: '1.6px dashed var(--ink-4)' }}>
            <div className="sk-label" style={{ fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
              优先级
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%" cy="50%"
                  innerRadius={32} outerRadius={56}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--ink)" strokeWidth={1.2}
                >
                  {priorityData.map((d) => (
                    <Cell key={d.priority} fill={PRIORITY_COLORS[d.priority]} fillOpacity={0.8} />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: 'Caveat, cursive', fontWeight: 700, fontSize: 22, fill: 'var(--ink)' }}>
                  {total}
                </text>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '2px solid var(--ink)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'Kalam, cursive',
                  }}
                  formatter={(value: any, name: string) => {
                    const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0
                    return [`${value} (${pct}%)`, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: 'Kalam, cursive', paddingTop: 0, marginTop: -8 }}
                  iconType="circle" iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Module treemap — right */}
          <div style={{ padding: '8px 12px 8px 4px' }}>
            <div className="sk-label" style={{ fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
              模块
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <Treemap
                data={moduleData}
                dataKey="size"
                stroke="var(--ink)" strokeWidth={1}
              />
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DistributionPanelSkeleton() {
  return (
    <Card>
      <div className="flex items-center justify-between" style={{ padding: '10px 16px' }}>
        <h3 className="sk-h3">任务分布</h3>
      </div>
      <div style={{ borderTop: '1.6px dashed var(--ink-4)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div style={{ padding: '12px', borderRight: '1.6px dashed var(--ink-4)' }}>
            <div style={{ height: 160, background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }} />
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ height: 160, background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }} />
          </div>
        </div>
      </div>
    </Card>
  )
}
