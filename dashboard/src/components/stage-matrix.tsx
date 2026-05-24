// src/components/stage-matrix.tsx
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StageStatus } from '@/lib/types'
import { useL2Navigation, l2FocusStyle } from '@/hooks/useL2Navigation'

interface StageMatrixProps {
  stages: StageStatus[]
  onStageClick?: (stageId: string) => void
}

const CARD_WIDTH = 200

type StageState = 'not_started' | 'in_progress' | 'completed'

function getStageState(s: StageStatus): StageState {
  const total = s.done + s.open + s.hold + s.blocked
  if (total === 0) return 'not_started'
  if (s.done >= total) return 'completed'
  if (s.done === 0 && s.inProgress === 0) return 'not_started'
  return 'in_progress'
}

const STATE_LABEL: Record<StageState, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
}

const STATE_COLOR: Record<StageState, string> = {
  not_started: 'var(--ink-3)',
  in_progress: 'var(--accent-2)',
  completed: 'var(--accent-3)',
}

const STATE_TINT: Record<StageState, string> = {
  not_started: 'rgba(120,120,120,0.06)',
  in_progress: 'rgba(245,180,60,0.10)',
  completed: 'rgba(80,170,110,0.10)',
}

const DONE_COLOR = STATE_COLOR.completed
const PROGRESS_COLOR = STATE_COLOR.in_progress

export default function StageMatrix({ stages, onStageClick }: StageMatrixProps) {
  // Loader already sorts by _meta.stages order; preserve as-is.
  const sorted = stages

  const itemIds = sorted.map(s => s.stageId)
  const { isL2, focusedIndex, nav } = useL2Navigation('stage-matrix', itemIds)

  // L2 Enter triggers onStageClick for the focused card
  useEffect(() => {
    if (!isL2 || !nav) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const itemId = itemIds[focusedIndex]
        if (itemId) onStageClick?.(itemId)
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [isL2, focusedIndex, itemIds, onStageClick, nav])

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>阶段矩阵</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>无阶段数据</p>
        </CardContent>
      </Card>
    )
  }

  const totalTasks = sorted.reduce((sum, s) => sum + s.done + s.open + s.hold + s.blocked, 0)

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h3 className="sk-h3">阶段矩阵</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {(['not_started', 'in_progress', 'completed'] as StageState[]).map((st) => (
              <span key={st} className="flex items-center gap-1">
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: STATE_COLOR[st],
                    border: '1px solid var(--ink)',
                  }}
                />
                {STATE_LABEL[st]}
              </span>
            ))}
          </div>
          <div className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {totalTasks} 任务 · 跨 {sorted.length} 阶段
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex" style={{ minWidth: sorted.length * CARD_WIDTH, position: 'relative' }}>
            {sorted.map((s, i, arr) => {
              const total = s.done + s.open + s.hold + s.blocked
              const ratio = total > 0 ? s.done / total : 0
              const state = getStageState(s)
              const stateColor = STATE_COLOR[state]
              const stateTint = STATE_TINT[state]
              return (
                <button
                  key={s.stageId}
                  data-nav-item={s.stageId}
                  onClick={() => onStageClick?.(s.stageId)}
                  className="text-left shrink-0"
                  style={{
                    width: CARD_WIDTH,
                    padding: '8px 14px 10px 14px',
                    borderRight: i < arr.length - 1 ? '1.6px dashed var(--ink-4)' : 'none',
                    borderLeft: `4px solid ${stateColor}`,
                    cursor: onStageClick ? 'pointer' : 'default',
                    background: stateTint,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    ...l2FocusStyle(isL2 && focusedIndex === i),
                  }}
                >
                  {/* Title row: ID + state chip */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="sk-h3" style={{ fontSize: 16 }}>{s.stageId}</span>
                    <span
                      className="sk-chip"
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        background: stateColor,
                        color: 'var(--paper)',
                        borderColor: 'var(--ink)',
                      }}
                    >
                      {STATE_LABEL[state]}
                    </span>
                  </div>

                  {/* Alias (project-specific stage name) */}
                  <span
                    className="sk-body block"
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      lineHeight: 1.2,
                      minHeight: 13,
                    }}
                    title={s.name === s.stageId ? '' : s.name}
                  >
                    {s.name === s.stageId ? '' : s.name}
                  </span>

                  {/* Total done/total */}
                  <div className="sk-num-sm">
                    {s.done}<span style={{ fontSize: 18, color: 'var(--ink-3)' }}>/{total}</span>
                  </div>

                  {/* Thick progress bar */}
                  <div className="sk-progress-track" style={{ height: 10 }}>
                    <div
                      className="sk-progress-fill"
                      style={{
                        width: `${Math.round(ratio * 100)}%`,
                        background: stateColor,
                      }}
                    />
                  </div>

                  {/* Status counts: done / in_progress / not started */}
                  <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    已完成 {s.done} · 进行中 {s.inProgress} · 未开始 {Math.max(s.open - s.inProgress, 0)}
                    {s.hold > 0 ? ` · 搁置 ${s.hold}` : ''}
                    {s.blocked > 0 ? ` · 阻塞 ${s.blocked}` : ''}
                  </div>

                  {/* Module breakdown */}
                  {s.modules.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px dashed var(--ink-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      {s.modules.map((m) => {
                          const donePct = m.total > 0 ? (m.done / m.total) * 100 : 0
                          const progPct = m.total > 0 ? (m.inProgress / m.total) * 100 : 0
                          return (
                            <div key={m.moduleId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span
                                  className="sk-body truncate"
                                  style={{ fontSize: 11, color: 'var(--ink-2)' }}
                                  title={m.moduleName}
                                >
                                  {m.moduleName}
                                </span>
                                <span
                                  className="sk-mono shrink-0"
                                  style={{ fontSize: 10, color: 'var(--ink-3)' }}
                                >
                                  {m.done}/{m.total}
                                  {m.inProgress > 0 && (
                                    <span style={{ color: PROGRESS_COLOR, marginLeft: 6 }}>
                                      · 进行中 {m.inProgress}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {/* Two-segment bar: done (green) + in_progress (orange) */}
                              <div
                                className="sk-progress-track"
                                style={{ height: 4, position: 'relative', overflow: 'hidden' }}
                              >
                                {donePct > 0 && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      height: '100%',
                                      width: `${donePct}%`,
                                      background: DONE_COLOR,
                                    }}
                                  />
                                )}
                                {progPct > 0 && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: `${donePct}%`,
                                      top: 0,
                                      height: '100%',
                                      width: `${progPct}%`,
                                      background: PROGRESS_COLOR,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StageMatrixSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>阶段矩阵</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex" style={{ minWidth: 5 * CARD_WIDTH }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0" style={{ width: CARD_WIDTH, padding: '8px 14px', borderRight: i < 4 ? '1.6px dashed var(--ink-4)' : 'none' }}>
                <span className="sk-bar dark short" style={{ height: 6 }} />
                <div style={{ marginTop: 6 }}>
                  <span className="sk-bar long" style={{ height: 22 }} />
                </div>
                <div style={{ marginTop: 4 }}>
                  <div className="sk-progress-track" style={{ height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
