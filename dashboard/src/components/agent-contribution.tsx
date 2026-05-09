// src/components/agent-contribution.tsx
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Round, Task } from '@/lib/types'

interface AgentContributionProps {
  rounds: Round[]
  tasks: Task[]
  agents?: { id: string; name: string }[]
}

// Palette of distinct colors for different agents
const AGENT_COLORS = [
  'var(--ink)',
  'var(--accent)',
  'var(--accent-2)',
  'var(--accent-3)',
  'var(--ink-2)',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
]

function resolveAgentName(
  executor: string,
  agents?: { id: string; name: string }[],
): string {
  if (agents) {
    const found = agents.find((a) => a.id === executor)
    if (found) return found.name
  }
  return executor
}

export default function AgentContribution({ rounds, tasks, agents }: AgentContributionProps) {
  const { chartData, agentNames } = useMemo(() => {
    // Sort rounds chronologically
    const sorted = [...rounds].sort((a, b) => a.startDate.localeCompare(b.startDate))

    // Build round periods
    const periods: { id: string; start: Date; end: Date; executor: string }[] = []
    for (let i = 0; i < sorted.length; i++) {
      const start = new Date(sorted[i].startDate)
      const end = i < sorted.length - 1
        ? new Date(sorted[i + 1].startDate)
        : new Date()
      periods.push({
        id: sorted[i].id,
        start,
        end,
        executor: resolveAgentName(sorted[i].executor, agents),
      })
    }

    // For each round period, find completed tasks and group by executor
    const completedTasks = tasks.filter((t) => t.status === 'completed' && t.completedAt)

    // Collect all unique agent names
    const allAgents = new Set<string>()

    const roundData = periods.map((p) => {
      const byAgent = new Map<string, number>()

      // Attribute completed tasks to the round's executor if completed in this period
      for (const t of completedTasks) {
        const completedDate = new Date(t.completedAt!)
        if (completedDate >= p.start && completedDate < p.end) {
          const agent = p.executor
          byAgent.set(agent, (byAgent.get(agent) ?? 0) + 1)
          allAgents.add(agent)
        }
      }

      const row: Record<string, string | number> = { round: p.id }
      for (const [agent, count] of byAgent) {
        row[agent] = count
      }
      return row
    })

    return {
      chartData: roundData,
      agentNames: [...allAgents],
    }
  }, [rounds, tasks, agents])

  const uniqueAgents = [...new Set(agentNames)]

  if (uniqueAgents.length < 2) {
  // Check if there are completed tasks
  const hasCompletedTasks = tasks.some((t) => t.status === 'completed')
  if (!hasCompletedTasks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent 贡献</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0' }}>
            暂无已完成任务
          </p>
        </CardContent>
      </Card>
    )
  }
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent 贡献</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0' }}>
            多 agent 数据不足 — 需要至少 2 个 agent 参与执行
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agent 贡献</CardTitle>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {uniqueAgents.length} agent · {chartData.length} 回合
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
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
            {uniqueAgents.map((agent, i) => (
              <Bar
                key={agent}
                dataKey={agent}
                name={agent}
                stackId="agents"
                fill={AGENT_COLORS[i % AGENT_COLORS.length]}
                fillOpacity={0.7}
                stroke="var(--ink)"
                strokeWidth={1}
                radius={i === uniqueAgents.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                barSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function AgentContributionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent 贡献</CardTitle>
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
