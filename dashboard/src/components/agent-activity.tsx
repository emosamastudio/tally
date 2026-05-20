// src/components/agent-activity.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useL2Navigation, l2FocusStyle } from '@/hooks/useL2Navigation'
import type { Round, Task } from '@/lib/types'

interface AgentActivityProps {
  rounds: Round[]
  tasks: Task[]
}

interface AgentInfo {
  agentId: string
  round: Round
  taskDetails: { taskId: string; name: string; status: string }[]
  done: number
  total: number
}

export default function AgentActivity({ rounds, tasks }: AgentActivityProps) {
  const activeRounds = rounds.filter((r) => r.status === 'active')

  const agents: AgentInfo[] = activeRounds.map((round) => {
    const taskDetails = round.tasks.map((rt) => {
      const task = tasks.find((t) => t.id === rt.taskId || t.id === rt.taskId.replace(/^[UD]-/, 'D-') || t.id === rt.taskId.replace(/^[UD]-/, 'U-'))
      return {
        taskId: rt.taskId,
        name: task?.name ?? rt.goal,
        status: task?.status ?? 'unknown',
      }
    })
    const done = taskDetails.filter((t) => t.status === 'completed').length
    return {
      agentId: round.executor,
      round,
      taskDetails,
      done,
      total: taskDetails.length,
    }
  })

  const itemIds: string[] = agents.flatMap((a) => [a.agentId, ...a.taskDetails.map((t) => t.taskId)])
  const { isL2, focusedIndex } = useL2Navigation('agent-activity', itemIds)

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>活跃 Agent</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无活跃 Agent</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="sk-h3">活跃 Agent · {agents.length}</h3>
      </div>
      <CardContent className="p-0">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {agents.map((a) => {
            const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0
            return (
              <div
                key={a.agentId}
                style={{
                  padding: '10px 14px',
                  background: 'var(--paper-2)',
                  borderRadius: 'var(--sk-radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {/* Agent header */}
                <div
                  className="flex items-baseline justify-between gap-3"
                  data-nav-item={a.agentId}
                  style={l2FocusStyle(isL2 && focusedIndex === itemIds.indexOf(a.agentId))}
                >
                  <div className="flex items-center gap-3">
                    <span className="sk-h3" style={{ fontSize: 14 }}>{a.agentId}</span>
                    <span className="sk-chip" style={{ fontSize: 10, background: a.done === a.total ? 'var(--accent-3)' : 'var(--accent-2)', color: 'var(--paper)' }}>
                      {a.done === a.total ? '完成' : '进行中'}
                    </span>
                  </div>
                  <span className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {a.round.id} · {a.round.scope}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="sk-progress-track" style={{ height: 6 }}>
                  <div
                    className="sk-progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: a.done === a.total ? 'var(--accent-3)' : 'var(--accent-2)',
                    }}
                  />
                </div>

                {/* Task list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {a.taskDetails.map((t) => (
                    <div
                      key={t.taskId}
                      className="flex items-baseline justify-between gap-3"
                      data-nav-item={t.taskId}
                      style={l2FocusStyle(isL2 && focusedIndex === itemIds.indexOf(t.taskId))}
                    >
                      <span
                        className="sk-mono"
                        style={{ fontSize: 11, color: t.status === 'completed' ? 'var(--ink-4)' : 'var(--ink-2)' }}
                      >
                        {t.taskId}
                      </span>
                      <span
                        className="sk-body truncate"
                        style={{
                          fontSize: 12,
                          color: t.status === 'completed' ? 'var(--ink-4)' : 'var(--ink-1)',
                          textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                          flex: 1,
                        }}
                      >
                        {t.name}
                      </span>
                      <span
                        className="sk-chip"
                        style={{
                          fontSize: 9,
                          background: t.status === 'completed' ? 'var(--accent-3)' : 'var(--paper)',
                          color: t.status === 'completed' ? 'var(--paper)' : 'var(--ink-3)',
                          borderColor: 'var(--ink-4)',
                        }}
                      >
                        {t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'wip' : t.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {a.done}/{a.total} 已完成 · {pct}%
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentActivitySkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>活跃 Agent</CardTitle></CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }}>
              <span className="sk-bar long" style={{ height: 14, width: '40%' }} />
              <div style={{ marginTop: 6 }}>
                <span className="sk-bar" style={{ height: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
