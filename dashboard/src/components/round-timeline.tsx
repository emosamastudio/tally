// src/components/round-timeline.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Round, Task } from '@/lib/types'
import { Clock, CheckCircle2, Play } from 'lucide-react'

interface RoundTimelineProps {
  rounds: Round[]
  tasks: Task[]
}

export default function RoundTimeline({ rounds, tasks }: RoundTimelineProps) {
  if (rounds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>回合时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            暂无回合数据
          </p>
        </CardContent>
      </Card>
    )
  }

  // Sort rounds chronologically by start date
  const sorted = [...rounds].sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">回合时间线</h3>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {rounds.length} 回合
        </span>
      </div>

      <CardContent className="p-0">
        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute left-[19px] top-2 bottom-2"
            style={{
              width: 2,
              background: 'var(--ink-4)',
              borderRadius: 1,
            }}
          />

          <div className="space-y-4">
            {sorted.map((round) => {
              const isActive = round.status === 'active'

              // Count done tasks for this round
              const plannedIds = new Set(round.tasks.map((rt) => rt.taskId))
              const doneCount = tasks.filter(
                (t) => plannedIds.has(t.id) && t.status === 'completed',
              ).length
              const totalCount = round.tasks.length

              return (
                <div key={round.id} className="flex gap-3 ml-2">
                  {/* Timeline dot */}
                  <div className="relative z-10 shrink-0 mt-1.5">
                    {isActive ? (
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          border: '2px solid var(--ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Play size={7} style={{ color: 'var(--ink)', marginLeft: 1 }} />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'var(--accent-3)',
                          border: '2px solid var(--ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircle2 size={8} style={{ color: 'var(--ink)' }} />
                      </div>
                    )}
                  </div>

                  {/* Round card */}
                  <div
                    className="sk-box fill flex-1"
                    style={{
                      padding: '10px 14px',
                      borderStyle: isActive ? 'solid' : 'dashed',
                      borderWidth: isActive ? 'var(--sk-border)' : '1.6px',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="sk-h3" style={{ fontSize: 18 }}>{round.id}</span>
                          <span className={`sk-chip ${isActive ? 'accent' : 'ok'}`} style={{ fontSize: 10 }}>
                            {isActive ? '进行中' : '已完成'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1" style={{ color: 'var(--ink-3)' }}>
                          <Clock size={11} style={{ color: 'var(--ink-3)' }} />
                          <span className="sk-body" style={{ fontSize: 11 }}>{round.startDate}</span>
                          <span className="sk-body" style={{ fontSize: 11 }}>·</span>
                          <span className="sk-body" style={{ fontSize: 11 }}>{round.executor}</span>
                        </div>
                        {round.scope && (
                          <p className="sk-body" style={{ fontSize: 12, marginTop: 4 }}>
                            {round.scope}
                          </p>
                        )}
                      </div>

                      {/* Task progress */}
                      {totalCount > 0 && (
                        <div className="text-right shrink-0">
                          <div className="sk-num-sm" style={{ fontSize: 24 }}>
                            {doneCount}<span style={{ fontSize: 16, color: 'var(--ink-3)' }}>/{totalCount}</span>
                          </div>
                          <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                            任务完成
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progress track */}
                    {totalCount > 0 && (
                      <div className="sk-progress-track" style={{ marginTop: 8, height: 6 }}>
                        <div
                          className={`sk-progress-fill ${isActive ? 'accent' : ''}`}
                          style={{
                            width: `${Math.round((doneCount / totalCount) * 100)}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Planned tasks */}
                    {round.tasks.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div className="sk-label" style={{ fontSize: 10, marginBottom: 4 }}>
                          计划任务
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {round.tasks.map((rt) => {
                            const task = tasks.find((t) => t.id === rt.taskId)
                            const isDone = task?.status === 'completed'
                            return (
                              <span
                                key={rt.taskId}
                                className={`sk-chip ${isDone ? 'ok' : ''}`}
                                style={{ fontSize: 10 }}
                                title={rt.goal}
                              >
                                {rt.taskId}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RoundTimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>回合时间线</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 ml-2">
              <div
                className="shrink-0 mt-1.5"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'var(--paper-2)',
                  border: '2px solid var(--ink-4)',
                }}
              />
              <div className="sk-box fill flex-1" style={{ padding: '10px 14px' }}>
                <span className="sk-bar dark med" style={{ height: 7 }} />
                <div style={{ marginTop: 4 }}>
                  <span className="sk-bar" style={{ width: '70%', height: 5 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
