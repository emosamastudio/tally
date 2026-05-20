// src/components/feature-progress.tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FeatureMeta, Task } from '@/lib/types'
import { useL2Navigation, l2FocusStyle } from '@/hooks/useL2Navigation'

// ── Color scale ──

function cellColor(pct: number, blocked: number): string {
  if (blocked > 0) return 'var(--danger)'
  if (pct >= 100) return 'var(--accent-3)'
  if (pct >= 70) return '#5b9bd5'
  if (pct >= 40) return 'var(--accent-2)'
  if (pct > 0) return 'var(--accent)'
  return 'var(--ink-4)'
}

function cellBg(pct: number): string {
  if (pct >= 100) return 'rgba(107,200,177,0.15)'
  if (pct >= 70) return 'rgba(91,155,213,0.10)'
  if (pct >= 40) return 'rgba(255,126,107,0.08)'
  if (pct > 0) return 'rgba(245,180,60,0.06)'
  return 'rgba(120,120,120,0.03)'
}

// ── Mini bar ──

function MiniBar({ pct, blocked }: { pct: number; blocked: number }) {
  return (
    <div className="sk-progress-track" style={{ height: 3, minWidth: 40 }}>
      <div className="sk-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: cellColor(pct, blocked) }} />
    </div>
  )
}

// ── Legend ──

function Legend() {
  const items: [string, string][] = [
    ['100%', 'var(--accent-3)'],
    ['≥70%', '#5b9bd5'],
    ['≥40%', 'var(--accent-2)'],
    ['>0%', 'var(--accent)'],
    ['0%', 'var(--ink-4)'],
    ['阻塞', 'var(--danger)'],
  ]
  return (
    <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Main component ──

interface FeatureProgressProps {
  features: FeatureMeta[]
  tasks: Task[]
}

export default function FeatureProgress({ features, tasks }: FeatureProgressProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Group features by module, compute task-level stats
  const byModule = new Map<string, { features: FeatureMeta[]; taskMap: Map<string, Task[]> }>()
  for (const f of features) {
    if (!byModule.has(f.module)) {
      byModule.set(f.module, { features: [], taskMap: new Map() })
    }
    byModule.get(f.module)!.features.push(f)
  }
  for (const t of tasks) {
    if (!t.feature) continue
    for (const [, mod] of byModule) {
      if (mod.features.some((f) => f.id === t.feature)) {
        if (!mod.taskMap.has(t.feature)) mod.taskMap.set(t.feature, [])
        mod.taskMap.get(t.feature)!.push(t)
        break
      }
    }
  }

  if (features.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>功能矩阵</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无功能数据</p>
        </CardContent>
      </Card>
    )
  }

  // Flatten all features for the heatmap, sorted by module
  const modules = [...byModule.keys()].sort()
  const allFeatures = modules.flatMap((m) => byModule.get(m)!.features)

  // L2 keyboard navigation
  const itemIds = allFeatures.map(f => f.id)
  const { isL2, focusedIndex } = useL2Navigation('feature-progress', itemIds)

  // Auto-expand focused row on Enter when L2 is active
  useEffect(() => {
    if (!isL2) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const id = itemIds[focusedIndex]
        if (id) {
          setExpanded(prev => prev === id ? null : id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isL2, focusedIndex, itemIds])

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="sk-h3">功能矩阵 · {allFeatures.length} 功能</h3>
        <Legend />
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Column headers: modules */}
          <div className="flex" style={{ minWidth: modules.length * 140 + 140 }}>
            <div style={{ width: 140, flexShrink: 0, padding: '0 8px' }}>
              <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)' }}>功能</span>
            </div>
            {modules.map((m) => (
              <div key={m} style={{ width: 140, flexShrink: 0, padding: '0 8px', textAlign: 'center' }}>
                <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-2)', fontWeight: 600 }}>{m}</span>
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {allFeatures.map((f, i) => {
            const pct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0
            const isModuleFirst = allFeatures.indexOf(f) === allFeatures.findIndex((x) => x.module === f.module)

            return (
              <div key={f.id}>
                {isModuleFirst && (
                  <div className="sk-body" style={{ fontSize: 9, color: 'var(--ink-4)', padding: '2px 8px', marginTop: 2 }}>
                    {f.module}
                  </div>
                )}
                <div className="flex" style={{ minWidth: modules.length * 140 + 140 }}>
                  {/* Feature name column */}
                  <button
                    className="text-left"
                    data-nav-item={f.id}
                    style={{
                      width: 140, flexShrink: 0, padding: '4px 8px',
                      borderBottom: '1px solid var(--ink-4)',
                      cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      display: 'flex', flexDirection: 'column', gap: 2,
                      ...l2FocusStyle(isL2 && focusedIndex === i),
                    }}
                    onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                  >
                    <span className="sk-mono truncate" style={{ fontSize: 10 }} title={f.name}>{f.id}</span>
                    <div className="flex items-center gap-2">
                      <MiniBar pct={pct} blocked={f.blocked} />
                      <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-3)' }}>{f.done}/{f.total}</span>
                    </div>
                  </button>

                  {/* Module cells — only the cell for this feature's module is active */}
                  {modules.map((m) => {
                    const isOwn = m === f.module
                    const bg = isOwn ? cellBg(pct) : 'transparent'

                    return (
                      <div
                        key={m}
                        style={{
                          width: 140, flexShrink: 0, padding: '4px 8px',
                          borderBottom: '1px solid var(--ink-4)',
                          background: bg,
                          display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center',
                        }}
                      >
                        {isOwn && (
                          <>
                            <div className="sk-progress-track" style={{ height: 4 }}>
                              <div className="sk-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: cellColor(pct, f.blocked) }} />
                            </div>
                            <div className="flex items-baseline justify-between" style={{ fontSize: 9 }}>
                              <span style={{ color: 'var(--ink-2)' }}>{pct}%</span>
                              {f.blocked > 0 && <span style={{ color: 'var(--danger)' }}>⊘{f.blocked}</span>}
                            </div>
                          </>
                        )}
                        {!isOwn && <span style={{ fontSize: 9, color: 'var(--ink-4)', textAlign: 'center' }}>—</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Expanded task list */}
                {expanded === f.id && (
                  <div style={{ padding: '6px 12px', background: 'var(--paper-2)', borderBottom: '1px solid var(--ink-4)' }}>
                    <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{f.name}</div>
                    {tasks.filter((t) => t.feature === f.id).slice(0, 10).map((t) => (
                      <div key={t.id} className="flex items-baseline gap-2" style={{ fontSize: 11, padding: '1px 0' }}>
                        <span className="sk-mono" style={{ color: 'var(--ink-3)' }}>{t.id}</span>
                        <span className="sk-body truncate" style={{ color: t.status === 'completed' ? 'var(--ink-4)' : 'var(--ink-1)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>{t.name}</span>
                        <span className="sk-chip" style={{ fontSize: 8, background: t.status === 'completed' ? 'var(--accent-3)' : 'var(--paper)', color: t.status === 'completed' ? 'var(--paper)' : 'var(--ink-3)' }}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function FeatureProgressSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>功能矩阵</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 400 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex" style={{ gap: 0 }}>
                <div style={{ width: 140, padding: '4px 8px' }}>
                  <span className="sk-bar long" style={{ height: 8 }} />
                </div>
                <div style={{ width: 140, padding: '4px 8px' }}>
                  <div className="sk-progress-track" style={{ height: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
