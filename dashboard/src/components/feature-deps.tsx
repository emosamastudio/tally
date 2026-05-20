// src/components/feature-deps.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FeatureMeta, Task } from '@/lib/types'

interface FeatureDepsProps {
  features: FeatureMeta[]
  tasks: Task[]
}

const STATUS_COLOR: Record<string, string> = {
  design: 'var(--ink-4)',
  contract_frozen: '#5b9bd5',
  implementing: 'var(--accent-2)',
  stable: 'var(--accent-3)',
}

const STATUS_LABEL: Record<string, string> = {
  design: '设计',
  contract_frozen: '契约冻结',
  implementing: '实现中',
  stable: '稳定',
}

export default function FeatureDeps({ features, tasks }: FeatureDepsProps) {
  if (features.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>功能依赖</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无功能依赖数据</p>
        </CardContent>
      </Card>
    )
  }

  // Build feature stats from tasks
  const featStats = new Map<string, { total: number; done: number }>()
  for (const t of tasks) {
    if (!t.feature) continue
    const s = featStats.get(t.feature) ?? { total: 0, done: 0 }
    s.total++
    if (t.status === 'completed') s.done++
    featStats.set(t.feature, s)
  }

  // Build adjacency for topological ordering
  const featIds = new Set(features.map((f) => f.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const f of features) {
    if (!inDegree.has(f.id)) inDegree.set(f.id, 0)
    if (!adjacency.has(f.id)) adjacency.set(f.id, [])
  }
  for (const f of features) {
    for (const depId of f.dependsOn ?? []) {
      if (featIds.has(depId)) {
        adjacency.get(depId)!.push(f.id)
        inDegree.set(f.id, (inDegree.get(f.id) ?? 0) + 1)
      }
    }
  }

  // Kahn topological sort → depth assignment
  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const depth = new Map<string, number>()
  for (const id of queue) depth.set(id, 0)

  while (queue.length > 0) {
    const curr = queue.shift()!
    for (const next of adjacency.get(curr) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) {
        depth.set(next, (depth.get(curr) ?? 0) + 1)
        queue.push(next)
      }
    }
  }

  // Sort by depth then name
  const sorted = [...features].sort((a, b) => {
    const da = depth.get(a.id) ?? 99
    const db = depth.get(b.id) ?? 99
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })

  // Group by depth for rendering lanes
  const byDepth = new Map<number, typeof features>()
  let maxDepth = 0
  for (const f of sorted) {
    const d = depth.get(f.id) ?? 0
    if (d > maxDepth) maxDepth = d
    const list = byDepth.get(d) ?? []
    list.push(f)
    byDepth.set(d, list)
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="sk-h3">功能依赖</h3>
        <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: STATUS_COLOR[key] }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', gap: 4, minWidth: (maxDepth + 1) * 180 }}>
            {Array.from({ length: maxDepth + 1 }, (_, d) => (
              <div key={d} style={{ flex: 1, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {d === 0 && (
                  <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', padding: '0 4px', marginBottom: 2 }}>
                    第 {d + 1} 层（无依赖）
                  </div>
                )}
                {d > 0 && (
                  <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', padding: '0 4px', marginBottom: 2 }}>
                    第 {d + 1} 层
                  </div>
                )}
                {(byDepth.get(d) ?? []).map((f) => {
                  const stats = featStats.get(f.id)
                  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
                  const deps = (f as any).dependsOn as string[] | undefined
                  return (
                    <div
                      key={f.id}
                      style={{
                        padding: '6px 8px',
                        background: 'var(--paper-2)',
                        borderRadius: 'var(--sk-radius)',
                        borderLeft: `3px solid ${STATUS_COLOR[(f as any).status as string] ?? 'var(--ink-4)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div className="sk-mono" style={{ fontSize: 11, fontWeight: 600 }}>{f.id}</div>
                      <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{f.name}</div>
                      {stats && (
                        <div className="sk-progress-track" style={{ height: 3 }}>
                          <div className="sk-progress-fill" style={{ width: `${pct}%`, background: STATUS_COLOR[(f as any).status as string] ?? 'var(--ink-4)' }} />
                        </div>
                      )}
                      {deps && deps.length > 0 && (
                        <div className="sk-body" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
                          ← {deps.join(', ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FeatureDepsSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>功能依赖</CardTitle></CardHeader>
      <CardContent>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, padding: '8px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }}>
              <span className="sk-bar long" style={{ height: 10, width: '60%' }} />
              <div style={{ marginTop: 4 }}>
                <span className="sk-bar" style={{ height: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
