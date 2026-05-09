// src/components/priority-donut.tsx
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Task, Priority } from '@/lib/types'

interface PriorityDonutProps {
  tasks: Task[]
}

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: 'var(--danger)',
  P1: 'var(--accent)',
  P2: 'var(--ink-3)',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'P0 · 紧急',
  P1: 'P1 · 重要',
  P2: 'P2 · 普通',
}

export default function PriorityDonut({ tasks }: PriorityDonutProps) {
  const data = useMemo(() => {
    const counts: Record<Priority, number> = { P0: 0, P1: 0, P2: 0 }
    for (const t of tasks) {
      counts[t.priority]++
    }
    return (Object.entries(counts) as [Priority, number][])
      .map(([priority, count]) => ({
        name: PRIORITY_LABEL[priority],
        value: count,
        priority,
      }))
      .filter((d) => d.value > 0)
  }, [tasks])

  const total = tasks.length

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>优先级分布</CardTitle>
        </CardHeader>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>优先级分布</CardTitle>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {total} 任务
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              stroke="var(--ink)"
              strokeWidth={1.6}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.priority}
                  fill={PRIORITY_COLORS[entry.priority]}
                  fillOpacity={0.8}
                />
              ))}
            </Pie>
            {/* Center label — total count */}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fontFamily: 'Caveat, cursive', fontWeight: 700, fontSize: 32, fill: 'var(--ink)' }}
            >
              {total}
            </text>
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '2px solid var(--ink)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'Kalam, cursive',
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink-2)', fontFamily: 'Caveat, cursive', fontWeight: 700, fontSize: 14 }}
              formatter={(value: any, name: string) => {
                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0
                return [`${value} 项 (${pct}%)`, name]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: 'Kalam, cursive', color: 'var(--ink-2)' }}
              iconType="circle"
              iconSize={10}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function PriorityDonutSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>优先级分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          style={{
            height: 220,
            background: 'var(--paper-2)',
            borderRadius: 'var(--sk-radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="sk-body" style={{ color: 'var(--ink-4)' }}>加载中...</span>
        </div>
      </CardContent>
    </Card>
  )
}
