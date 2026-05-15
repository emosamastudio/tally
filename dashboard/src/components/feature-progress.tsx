// src/components/feature-progress.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { FeatureMeta, Task } from '@/lib/types'

// ── Status inference ──

type FeatureStatus = 'design' | 'contract_frozen' | 'implementing' | 'stable'

const STATUS_LABEL: Record<FeatureStatus, string> = {
  design: '设计中',
  contract_frozen: '契约冻结',
  implementing: '实现中',
  stable: '稳定',
}

const STATUS_COLOR: Record<FeatureStatus, string> = {
  design: 'var(--ink-4)',
  contract_frozen: '#5b9bd5',
  implementing: 'var(--accent-2)',
  stable: 'var(--accent-3)',
}

const STATUS_BG: Record<FeatureStatus, string> = {
  design: 'rgba(170,163,163,0.12)',
  contract_frozen: 'rgba(91,155,213,0.12)',
  implementing: 'rgba(255,126,107,0.12)',
  stable: 'rgba(107,200,177,0.12)',
}

// ── Enriched feature ──

interface EnrichedFeature extends FeatureMeta {
  status: FeatureStatus
  inProgress: number
  pendingTasks: Task[]
}

function inferStatus(feature: FeatureMeta, inProgress: number): FeatureStatus {
  const notDone = feature.total - feature.done
  if (notDone === 0 && feature.total > 0) return 'stable'
  if (inProgress > 0) return 'implementing'
  if (feature.done > 0) return 'contract_frozen'
  return 'design'
}

function enrichFeatures(features: FeatureMeta[], tasks: Task[]): EnrichedFeature[] {
  return features.map((f) => {
    const featureTasks = tasks.filter((t) => t.feature === f.id)
    const inProgress = featureTasks.filter((t) => t.status === 'in_progress').length
    const pendingTasks = featureTasks
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .sort((a, b) => a.order - b.order)
      .slice(0, 3)

    return {
      ...f,
      status: inferStatus(f, inProgress),
      inProgress,
      pendingTasks,
    }
  })
}

// ── Group by module ──

interface ModuleGroup {
  module: string
  features: EnrichedFeature[]
}

function groupByModule(features: EnrichedFeature[]): ModuleGroup[] {
  const map = new Map<string, EnrichedFeature[]>()
  for (const f of features) {
    const list = map.get(f.module) ?? []
    list.push(f)
    map.set(f.module, list)
  }
  return [...map.entries()]
    .map(([module, features]) => ({ module, features }))
    .sort((a, b) => a.module.localeCompare(b.module, 'zh-Hans-CN'))
}

// ── Main component ──

interface FeatureProgressProps {
  features: FeatureMeta[]
  tasks: Task[]
}

export default function FeatureProgress({ features, tasks }: FeatureProgressProps) {
  const enriched = enrichFeatures(features, tasks)
  const groups = groupByModule(enriched)

  // All modules start expanded
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleModule = (moduleId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  if (features.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>功能进度</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无功能数据</p>
        </CardContent>
      </Card>
    )
  }

  const totalFeatures = features.length
  const stableFeatures = enriched.filter((f) => f.status === 'stable').length

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h3 className="sk-h3">功能进度</h3>
        <div className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {totalFeatures} 功能 · {stableFeatures} 稳定 · 跨 {groups.length} 模块
        </div>
      </div>

      <CardContent className="p-0">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.module)
            return (
              <div key={group.module}>
                {/* Module header — accordion toggle */}
                <button
                  onClick={() => toggleModule(group.module)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    width: '100%',
                    border: 'none',
                    borderBottom: isCollapsed ? 'none' : '1.2px dashed var(--ink-4)',
                    background: 'rgba(0,0,0,0.03)',
                    textAlign: 'left',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className="sk-h3" style={{ fontSize: 17 }}>{group.module}</span>
                  <span className="sk-chip" style={{ fontSize: 10, marginLeft: 8 }}>
                    {group.features.length} 功能
                  </span>
                </button>

                {/* Feature cards */}
                {!isCollapsed && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 8,
                      padding: '8px 14px 12px',
                    }}
                  >
                    {group.features.map((f) => {
                      const pct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0
                      const statusColor = STATUS_COLOR[f.status]
                      const statusBg = STATUS_BG[f.status]
                      return (
                        <div
                          key={f.id}
                          style={{
                            border: '1.6px solid var(--ink)',
                            borderLeft: `4px solid ${statusColor}`,
                            borderRadius: 'var(--sk-radius)',
                            background: statusBg,
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          {/* Header row: name + status badge */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="sk-body" style={{ fontWeight: 700, fontSize: 13 }}>
                              {f.name}
                            </span>
                            <span
                              className="sk-chip"
                              style={{
                                fontSize: 10,
                                padding: '1px 7px',
                                background: statusColor,
                                color: 'var(--paper)',
                                borderColor: 'var(--ink)',
                              }}
                            >
                              {STATUS_LABEL[f.status]}
                            </span>
                          </div>

                          {/* Progress bar + done/total */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="sk-progress-track" style={{ flex: 1, height: 8 }}>
                              <div
                                className="sk-progress-fill"
                                style={{
                                  width: `${pct}%`,
                                  background: statusColor,
                                }}
                              />
                            </div>
                            <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                              {f.done}/{f.total}
                            </span>
                          </div>

                          {/* Blocked count */}
                          {f.blocked > 0 && (
                            <div className="sk-mono" style={{ fontSize: 10, color: 'var(--danger)' }}>
                              阻塞: {f.blocked}
                            </div>
                          )}

                          {/* Mini task list — 3 most recent pending/in_progress */}
                          {f.pendingTasks.length > 0 && (
                            <div
                              style={{
                                marginTop: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              {f.pendingTasks.map((t) => (
                                <div
                                  key={t.id}
                                  className="sk-mono"
                                  style={{
                                    fontSize: 10,
                                    color: 'var(--ink-3)',
                                    paddingLeft: 6,
                                    borderLeft: '2px solid var(--ink-4)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={t.name}
                                >
                                  {t.status === 'in_progress' ? '▶ ' : '○ '}
                                  {t.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
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

// ── Skeleton ──

export function FeatureProgressSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>功能进度</CardTitle></CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi}>
              <div style={{ marginBottom: 8 }}>
                <span className="sk-bar med" style={{ height: 20 }} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 8,
                }}
              >
                {Array.from({ length: 3 }).map((_, fi) => (
                  <div
                    key={fi}
                    style={{
                      border: '1.6px solid var(--ink)',
                      borderRadius: 'var(--sk-radius)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <span className="sk-bar long" style={{ height: 7 }} />
                    <div className="sk-progress-track" style={{ height: 8 }} />
                    <span className="sk-bar" style={{ width: 60, height: 5 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
