// src/components/round-analytics.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Round, Task } from '@/lib/types'

interface RoundAnalyticsProps {
  rounds: Round[]
  tasks: Task[]
}

function buildChartData(rounds: Round[], tasks: Task[]) {
  // Sort rounds chronologically
  const sorted = [...rounds].sort((a, b) => a.startDate.localeCompare(b.startDate))

  // Build round periods: [start, end) where end is next round's start or "now" for the last round
  const periods: { id: string; start: Date; end: Date }[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = new Date(sorted[i].startDate)
    const end = i < sorted.length - 1
      ? new Date(sorted[i + 1].startDate)
      : new Date() // active round or last completed round
    periods.push({ id: sorted[i].id, start, end })
  }

  // Only consider completed tasks (strip U- prefix for display)
  const completedTasks = tasks.filter((t) => t.status === 'completed' && t.completedAt)

  // Count tasks completed in each round period
  let cumulative = 0
  return periods.map((p) => {
    const doneInRound = completedTasks.filter((t) => {
      const completedDate = new Date(t.completedAt!)
      return completedDate >= p.start && completedDate < p.end
    }).length
    cumulative += doneInRound
    return {
      round: p.id,
      done: doneInRound,
      cumulative,
    }
  })
}

export default function RoundAnalytics({ rounds, tasks }: RoundAnalyticsProps) {
  const data = buildChartData(rounds, tasks)

  // Need at least 2 rounds to show trends
  const completedRounds = data.filter((d) => d.done > 0)
  if (completedRounds.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>回合分析</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0' }}>
            回合数据不足 — 需要至少 2 个有已完成任务的回合
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>回合分析</CardTitle>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {rounds.length} 回合 · 燃尽 + 速率
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="rgba(0,0,0,0.08)" />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 10, fill: 'var(--ink-3)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--ink-4)' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={40}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'Kalam, cursive' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'Kalam, cursive' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
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
            />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: 'Kalam, cursive', color: 'var(--ink-2)' }}
            />
            <Bar
              yAxisId="left"
              dataKey="done"
              name="本回合完成"
              fill="var(--ink)"
              fillOpacity={0.25}
              stroke="var(--ink)"
              strokeWidth={1.6}
              radius={[4, 4, 0, 0]}
              barSize={28}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              name="累计完成"
              stroke="var(--accent-2)"
              strokeWidth={2.4}
              dot={{ r: 3, fill: 'var(--accent-2)', stroke: 'var(--paper)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--accent-2)', stroke: 'var(--paper)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RoundAnalyticsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>回合分析</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          style={{
            height: 260,
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
