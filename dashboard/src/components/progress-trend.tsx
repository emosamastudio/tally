// src/components/progress-trend.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { ProgressPoint } from '@/lib/types'

interface ProgressTrendProps {
  osHistory: ProgressPoint[]
  appHistory: ProgressPoint[]
}

function buildChartData(osHistory: ProgressPoint[], appHistory: ProgressPoint[]) {
  const allDates = new Set<string>()
  const osByDate = new Map<string, number>()
  const appByDate = new Map<string, number>()

  for (const p of osHistory) {
    allDates.add(p.date)
    osByDate.set(p.date, p.osDone)
  }
  for (const p of appHistory) {
    allDates.add(p.date)
    appByDate.set(p.date, p.appDone)
  }

  const sorted = Array.from(allDates).sort()
  return sorted.map((date) => ({
    date,
    OS: osByDate.get(date) ?? null,
    App: appByDate.get(date) ?? null,
  }))
}

export default function ProgressTrend({ osHistory, appHistory }: ProgressTrendProps) {
  const data = buildChartData(osHistory, appHistory)
  const hasAppData = appHistory.length > 0

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>进度趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            暂无进度数据。里程碑达成时记录进度。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>进度趋势</CardTitle>
        <div className="flex gap-1.5">
          <span className="sk-chip accent" style={{ fontSize: 11 }}>回合</span>
          <span className="sk-chip" style={{ fontSize: 11 }}>日</span>
          <span className="sk-chip" style={{ fontSize: 11 }}>周</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex gap-4 mb-2" style={{ fontSize: 12 }}>
          <span className="sk-body" style={{ fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--ink)', verticalAlign: 'middle', marginRight: 4 }} />
            已完成
          </span>
          {hasAppData && (
            <span className="sk-body" style={{ fontSize: 12 }}>
              <span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--accent-3)', verticalAlign: 'middle', marginRight: 4 }} />
              App 完成数
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="rgba(0,0,0,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'Kalam, cursive' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--ink-4)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'Kalam, cursive' }}
              tickLine={false}
              axisLine={false}
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
            <ReferenceLine
              y={80}
              stroke="var(--ink-4)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="OS"
              stroke="var(--ink)"
              fill="var(--ink)"
              fillOpacity={0.08}
              strokeWidth={2.2}
              connectNulls
              dot={{ r: 3, fill: 'var(--ink)', stroke: 'var(--paper)', strokeWidth: 2 }}
            />
            {hasAppData && (
              <Area
                type="monotone"
                dataKey="App"
                stroke="var(--accent-3)"
                fill="var(--accent-3)"
                fillOpacity={0.12}
                strokeWidth={2.2}
                connectNulls
                dot={{ r: 3, fill: 'var(--accent-3)', stroke: 'var(--paper)', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function ProgressTrendSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>进度趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 260, background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="sk-body" style={{ color: 'var(--ink-4)' }}>加载中...</span>
        </div>
      </CardContent>
    </Card>
  )
}
