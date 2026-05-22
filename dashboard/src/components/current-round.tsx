// src/components/current-round.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronRight, Clock, CheckCircle2, Play } from 'lucide-react'
import type { Round, Task } from '@/lib/types'

interface CurrentRoundProps {
  round: Round | null
  /** All rounds for the collapsible timeline section */
  allRounds?: Round[]
  /** All tasks for computing round completion stats */
  allTasks?: Task[]
}

export default function CurrentRound({ round, allRounds, allTasks }: CurrentRoundProps) {
  const [showHistory, setShowHistory] = useState(false)

  if (!round) {
    // Show most recent completed round if available
    const lastCompleted = allRounds?.filter((r) => r.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    return (
      <Card tilt={1}>
        <CardHeader>
          <CardTitle>当前回合</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>无活跃回合</p>
          {lastCompleted && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }}>
              <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>最近完成</div>
              <div className="sk-mono" style={{ fontSize: 12, marginTop: 2 }}>{lastCompleted.id}</div>
              <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{lastCompleted.scope}</div>
              <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
                完成于 {lastCompleted.completedAt} · {lastCompleted.tasks.length} 任务
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const isActive = round.status === 'active'
  const plannedIds = new Set(round.tasks.map((rt) => rt.taskId))
  const doneCount = (allTasks ?? []).filter(
    (t) => plannedIds.has(t.id) && t.status === 'completed',
  ).length
  const totalCount = round.tasks.length

  // Build timeline data: all rounds sorted chronologically, excluding the active round shown above
  const roundsArr = allRounds ?? []
  const timelineRounds = roundsArr
    .filter((r) => r.id !== round.id)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <Card tilt={1} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">当前回合</h3>
        <span className={`sk-chip ${isActive ? 'accent' : 'ok'}`}>
          {isActive ? '进行中' : '已完成'}
        </span>
      </div>

      <div className="min-w-0">
        <div className="sk-body truncate" style={{ fontSize: 13 }}>{round.id}</div>
        <div className="sk-label truncate" style={{ fontSize: 11, marginTop: 2 }}>{round.startDate} · {round.executor}</div>
      </div>

      {/* Progress ring */}
      <div className="flex items-center gap-4 mt-2">
        <svg width="80" height="80" role="img" aria-label={`回合进度: ${totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%, ${doneCount}/${totalCount} 任务完成`}>
          <title>回合进度: {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%, {doneCount}/{totalCount} 任务完成</title>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--ink-4)" strokeWidth="6" strokeDasharray="3 3" />
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--ink)" strokeWidth="5"
            strokeDasharray={`${(totalCount > 0 ? doneCount / totalCount : 0) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
            transform="rotate(-90 40 40)" strokeLinecap="round" />
          <text x="40" y="46" textAnchor="middle" style={{ fontFamily: 'Caveat, cursive', fontSize: 24, fontWeight: 700, fill: 'var(--ink)' }}>
            {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="sk-body" style={{ fontSize: 12 }}>
            任务 · <b>{doneCount}/{totalCount}</b>
          </div>
          {round.scope && (
            <div className="sk-body truncate" style={{ fontSize: 12 }}>{round.scope}</div>
          )}
        </div>
      </div>

      {round.tasks.length > 0 && (
        <>
          <hr className="sk-rule dashed" style={{ margin: '4px 0' }} />
          <div className="sk-label" style={{ fontSize: 11 }}>回合任务</div>
          <div className="flex flex-col gap-1.5">
            {round.tasks.map((rt) => (
              <div key={rt.taskId} className="flex items-start gap-2">
                <span className="sk-chip" style={{ fontSize: 10, flexShrink: 0 }}>{rt.taskId}</span>
                <span className="sk-body" style={{ fontSize: 12 }}>{rt.goal}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Phase chips — derived from actual stage data */}
      {round.tasks.length > 0 && (
        <>
          <hr className="sk-rule dashed" style={{ margin: '4px 0' }} />
          <div className="sk-label" style={{ fontSize: 11 }}>计划任务</div>
          <div className="flex gap-1.5 flex-wrap">
            {round.tasks.map((rt) => (
              <span key={rt.taskId} className="sk-chip" style={{ fontSize: 10 }}>
                {rt.taskId}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Collapsible Round History */}
      {timelineRounds.length > 0 && (
        <>
          <hr className="sk-rule dashed" style={{ margin: '4px 0' }} />
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 sk-body"
            style={{
              fontSize: 12,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--ink-2)',
              fontFamily: 'inherit',
            }}
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            回合历史 ({timelineRounds.length})
          </button>

          {showHistory && (
            <div className="relative" style={{ marginTop: 8 }}>
              {/* Vertical timeline line */}
              <div
                className="absolute left-[12px] top-1 bottom-1"
                style={{
                  width: 2,
                  background: 'var(--ink-4)',
                  borderRadius: 1,
                }}
              />

              <div className="space-y-3">
                {timelineRounds.map((r) => {
                  const plannedIds = new Set(r.tasks.map((rt) => rt.taskId))
                  const rDoneCount = (allTasks ?? []).filter(
                    (t) => plannedIds.has(t.id) && t.status === 'completed',
                  ).length
                  const rTotalCount = r.tasks.length

                  return (
                    <div key={r.id} className="flex gap-2.5 ml-1">
                      {/* Timeline dot */}
                      <div className="relative z-10 shrink-0 mt-1">
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: r.status === 'active' ? 'var(--accent)' : 'var(--accent-3)',
                            border: '2px solid var(--ink)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {r.status === 'active' ? (
                            <Play size={5} style={{ color: 'var(--ink)', marginLeft: 0.5 }} />
                          ) : (
                            <CheckCircle2 size={6} style={{ color: 'var(--ink)' }} />
                          )}
                        </div>
                      </div>

                      {/* Round card */}
                      <div
                        className="sk-box fill flex-1"
                        style={{
                          padding: '6px 10px',
                          borderStyle: r.status === 'active' ? 'solid' : 'dashed',
                          borderWidth: r.status === 'active' ? 'var(--sk-border)' : '1.2px',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="sk-body" style={{ fontSize: 11, fontWeight: 700 }}>{r.id}</span>
                              <span className={`sk-chip ${r.status === 'active' ? 'accent' : 'ok'}`} style={{ fontSize: 9 }}>
                                {r.status === 'active' ? '进行中' : '已完成'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--ink-3)' }}>
                              <Clock size={9} />
                              <span className="sk-body" style={{ fontSize: 10 }}>{r.startDate}</span>
                              <span className="sk-body" style={{ fontSize: 10 }}>·</span>
                              <span className="sk-body" style={{ fontSize: 10 }}>{r.executor}</span>
                            </div>
                          </div>
                          {rTotalCount > 0 && (
                            <div className="text-right shrink-0">
                              <span className="sk-num-sm" style={{ fontSize: 16 }}>
                                {rDoneCount}<span style={{ fontSize: 11, color: 'var(--ink-3)' }}>/{rTotalCount}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        {rTotalCount > 0 && (
                          <div className="sk-progress-track" style={{ marginTop: 6, height: 4 }}>
                            <div
                              className={`sk-progress-fill ${r.status === 'active' ? 'accent' : ''}`}
                              style={{ width: `${Math.round((rDoneCount / rTotalCount) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export function CurrentRoundSkeleton() {
  return (
    <Card tilt={1}>
      <div className="flex justify-between">
        <h3 className="sk-h3">当前回合</h3>
      </div>
      <div className="space-y-3 mt-3">
        <span className="sk-bar long dark" style={{ height: 7 }} />
        <span className="sk-bar med" style={{ height: 6 }} />
        <div className="h-20" style={{ background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }} />
      </div>
    </Card>
  )
}
