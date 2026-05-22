// src/components/round-timeline.tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Round, Task } from '@/lib/types'
import { CheckCircle2, Play, ChevronDown, ChevronRight } from 'lucide-react'
import { useL2Navigation, l2FocusStyle } from '@/hooks/useL2Navigation'

interface RoundTimelineProps {
  rounds: Round[]
  tasks: Task[]
}

const MAX_VISIBLE = 10

export default function RoundTimeline({ rounds, tasks }: RoundTimelineProps) {
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (rounds.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>回合时间线</CardTitle></CardHeader>
        <CardContent>
          <div>
            <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无回合数据</p>
            <p className="sk-body" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
              运行 <code className="sk-mono" style={{ fontSize: 11 }}>tally round start</code> 开始第一个回合
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  const sorted = [...rounds].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE)
  const hidden = sorted.length - MAX_VISIBLE

  // L2 keyboard navigation
  const itemIds = visible.map(r => r.id)
  const { isL2, focusedIndex } = useL2Navigation('round-timeline', itemIds)

  // L2 Enter: auto-expand focused round
  useEffect(() => {
    if (!isL2) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const id = itemIds[focusedIndex]
        if (id) {
          setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isL2, focusedIndex, itemIds])

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">回合时间线</h3>
        <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {rounds.length} 回合{!showAll && hidden > 0 ? ` · 最近 ${MAX_VISIBLE}` : ''}
        </span>
      </div>

      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2" style={{ width: 2, background: 'var(--ink-4)', borderRadius: 1 }} />

          <div className="space-y-3">
            {visible.map((round, i) => {
              const isActive = round.status === 'active'
              const plannedIds = new Set(round.tasks.map((rt) => rt.taskId))
              const doneCount = tasks.filter((t) => plannedIds.has(t.id) && t.status === 'completed').length
              const totalCount = round.tasks.length
              const isExpanded = expanded.has(round.id) || isActive

              return (
                <div key={round.id} className="flex gap-3 ml-2">
                  <div className="relative z-10 shrink-0 mt-1.5">
                    {isActive ? (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={7} style={{ color: 'var(--ink)', marginLeft: 1 }} />
                      </div>
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent-3)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={8} style={{ color: 'var(--ink)' }} />
                      </div>
                    )}
                  </div>

                  <div
                    className="sk-box fill flex-1"
                    data-nav-item={round.id}
                    style={{
                      padding: '8px 12px',
                      borderStyle: isActive ? 'solid' : 'dashed',
                      borderWidth: isActive ? 'var(--sk-border)' : '1.6px',
                      cursor: isActive ? 'default' : 'pointer',
                      ...l2FocusStyle(isL2 && focusedIndex === i),
                    }}
                    onClick={() => !isActive && toggleExpand(round.id)}
                  >
                    {/* Compact header row — always visible */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!isActive && (
                          <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                        )}
                        <span className="sk-mono" style={{ fontSize: 13, fontWeight: 600 }}>{round.id}</span>
                        <span className={`sk-chip ${isActive ? 'accent' : 'ok'}`} style={{ fontSize: 9 }}>
                          {isActive ? '进行中' : '已完成'}
                        </span>
                        <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{round.startDate}</span>
                        <span className="sk-body truncate" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{round.executor}</span>
                      </div>
                      {totalCount > 0 && (
                        <span className="sk-mono shrink-0" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {doneCount}/{totalCount}
                        </span>
                      )}
                    </div>

                    {/* Expanded detail — only for active rounds or clicked rounds */}
                    {isExpanded && (
                      <div style={{ marginTop: 6 }}>
                        {round.scope && (
                          <p className="sk-body" style={{ fontSize: 11, marginBottom: 4 }}>{round.scope}</p>
                        )}
                        {totalCount > 0 && (
                          <div className="sk-progress-track" style={{ height: 4, marginBottom: 4 }}>
                            <div className={`sk-progress-fill ${isActive ? 'accent' : ''}`}
                              style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }} />
                          </div>
                        )}
                        {round.tasks.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {round.tasks.map((rt) => {
                              const task = tasks.find((t) => t.id === rt.taskId)
                              return (
                                <span key={rt.taskId} className={`sk-chip ${task?.status === 'completed' ? 'ok' : ''}`}
                                  style={{ fontSize: 9 }} title={rt.goal}>{rt.taskId}</span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {hidden > 0 && !showAll && (
          <button
            className="sk-body mt-3"
            style={{ fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'center', padding: '6px 0' }}
            onClick={() => setShowAll(true)}
          >
            显示全部 {hidden} 个旧回合 ↓
          </button>
        )}
        {showAll && hidden > 0 && (
          <button
            className="sk-body mt-3"
            style={{ fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'center', padding: '6px 0' }}
            onClick={() => setShowAll(false)}
          >
            收起 · 仅显示最近 {MAX_VISIBLE} 个 ↑
          </button>
        )}
      </CardContent>
    </Card>
  )
}

export function RoundTimelineSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>回合时间线</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 ml-2">
              <div className="shrink-0 mt-1.5" style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--paper-2)', border: '2px solid var(--ink-4)' }} />
              <div className="sk-box fill flex-1" style={{ padding: '8px 12px' }}>
                <span className="sk-bar dark med" style={{ height: 7 }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
