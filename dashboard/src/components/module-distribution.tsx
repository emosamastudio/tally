// src/components/module-distribution.tsx
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts'
import type { Task } from '@/lib/types'

interface ModuleDistributionProps {
  tasks: Task[]
}

function cellColor(completed: number, total: number): string {
  if (total === 0) return 'var(--ink-4)'
  const ratio = completed / total
  if (ratio >= 1) return 'var(--accent-3)'   // green — all done
  if (ratio >= 0.5) return 'var(--accent)'    // yellow — partial
  return 'var(--accent-2)'                     // red — none/little done
}

/** Custom label content — drawn as a child via Treemap's child-render API */
function CustomContent(props: any) {
  const { x, y, width, height, name, size, done, fill } = props
  if (width == null || height == null) return null
  const ratio = done != null && size > 0 ? done / size : 0
  const pct = Math.round(ratio * 100)
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill ?? cellColor(done ?? 0, size ?? 1)}
        fillOpacity={0.7}
        stroke="var(--ink)"
        strokeWidth={1.4}
        rx={3}
        ry={3}
      />
      {width > 50 && height > 32 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 5}
            textAnchor="middle"
            fill="var(--ink)"
            fontSize={11}
            fontFamily="Kalam, cursive"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="var(--ink-2)"
            fontSize={10}
            fontFamily="JetBrains Mono, ui-monospace, monospace"
          >
            {size} · {pct}%
          </text>
        </>
      )}
    </g>
  )
}

export default function ModuleDistribution({ tasks }: ModuleDistributionProps) {
  const data = useMemo(() => {
    const groups = new Map<string, { name: string; total: number; done: number }>()
    for (const t of tasks) {
      const mod = t.module || '未分类'
      if (!groups.has(mod)) {
        groups.set(mod, { name: mod, total: 0, done: 0 })
      }
      const g = groups.get(mod)!
      g.total++
      if (t.status === 'completed') g.done++
    }
    return [...groups.entries()]
      .map(([id, g]) => ({
        name: id,
        size: g.total,
        done: g.done,
        fill: cellColor(g.done, g.total),
      }))
      .sort((a, b) => b.size - a.size)
  }, [tasks])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>模块分布</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0' }}>
            无模块数据
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>模块分布</CardTitle>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {data.length} 模块
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="var(--ink)"
            isAnimationActive={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={CustomContent as any}
          >
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
              formatter={(_value: any, _name: any, props: any) => {
                const pct = props.payload?.size > 0
                  ? Math.round((props.payload.done / props.payload.size) * 100)
                  : 0
                return [`${props.payload.size} 任务 · ${pct}% 完成`, props.payload.name]
              }}
            />
          </Treemap>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2" style={{ borderTop: '1.6px dashed rgba(0,0,0,0.25)', marginTop: 8 }}>
          <span className="sk-label" style={{ fontSize: 10 }}>完成率:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'var(--accent-3)', opacity: 0.7, border: '1.4px solid var(--ink)' }} />
            <span className="sk-body" style={{ fontSize: 11 }}>全部完成</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'var(--accent)', opacity: 0.7, border: '1.4px solid var(--ink)' }} />
            <span className="sk-body" style={{ fontSize: 11 }}>部分完成</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'var(--accent-2)', opacity: 0.7, border: '1.4px solid var(--ink)' }} />
            <span className="sk-body" style={{ fontSize: 11 }}>未完成</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ModuleDistributionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>模块分布</CardTitle>
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
