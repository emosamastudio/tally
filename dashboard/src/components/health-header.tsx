// src/components/health-header.tsx
import { Card } from '@/components/ui/card'
import type { Round, Task, FeatureMeta, BlockItem } from '@/lib/types'

interface HealthHeaderProps {
  tasks: Task[]
  activeRound: Round | null
  blocks: BlockItem[]
  features: FeatureMeta[]
}

export default function HealthHeader({ tasks, blocks }: HealthHeaderProps) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'completed').length
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'hold').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // Drift: done tasks without commit evidence
  const driftCount = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const ev = t.evidence ?? ''
    return (t.writeScopes?.length ?? 0) > 0 && !ev.includes('[commit:')
  }).length

  // Unapproved high-risk
  const unapproved = tasks.filter((t) =>
    (t.riskLevel === 'high' || t.riskLevel === 'critical') && !t.approvedBy && t.status !== 'completed'
  ).length

  // Delivery nodes
  const nodeMap = new Map<string, { total: number; done: number }>()
  for (const t of tasks) {
    const node = t.deliveryNode
    if (!node) continue
    if (!nodeMap.has(node)) nodeMap.set(node, { total: 0, done: 0 })
    const nd = nodeMap.get(node)!
    nd.total++
    if (t.status === 'completed') nd.done++
  }
  const topNode = [...nodeMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)[0]

  // Health color
  const isNew = total === 0
  const healthColor = isNew ? 'var(--ink-3)' : pct >= 80 ? 'var(--accent-3)' : pct >= 50 ? 'var(--accent-2)' : 'var(--danger)'
  const healthLabel = isNew ? '新项目' : pct >= 80 ? '正常' : pct >= 50 ? '需关注' : '风险'
  const issues = blocked + driftCount + unapproved + blocks.length
  const hasIssues = issues > 0

  return (
    <div className="space-y-3">
      <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top row: health + key metrics */}
        <div className="flex items-center gap-6 flex-wrap">
          {/* Health ring */}
          <div className="flex items-center gap-3">
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `conic-gradient(${healthColor} ${pct * 3.6}deg, var(--paper-2) ${pct * 3.6}deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--ink)',
            }}>
              <span className="sk-num sk-text-xl">{pct}%</span>
            </div>
            <div>
              <div className="sk-h3 sk-text-xl">项目健康</div>
              <span className="sk-chip sk-text-xs" style={{ background: healthColor, color: 'var(--paper)' }}>{healthLabel}</span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex items-center gap-4 flex-wrap" style={{ flex: 1 }}>
            <MetricBadge label="已完成" value={`${done}`} sub={`/ ${total}`} color="var(--accent-3)" />
            <MetricBadge label="进行中" value={`${open}`} sub="开放" color="var(--accent-2)" />
            {hasIssues ? (
              <MetricBadge label="⚠ 需处理" value={`${issues}`} sub="项" color="var(--danger)" pulse />
            ) : (
              <MetricBadge label="需处理" value="0" sub="无异常" color="var(--accent-3)" />
            )}
            {blocked > 0 && <MetricBadge label="阻塞" value={`${blocked}`} sub="任务" color="var(--danger)" />}
            {driftCount > 0 && <MetricBadge label="漂移" value={`${driftCount}`} sub="缺证据" color="var(--accent)" />}
            {unapproved > 0 && <MetricBadge label="未审批" value={`${unapproved}`} sub="高风险" color="var(--accent-2)" />}
          </div>
        </div>

        {/* Delivery node progress */}
        {topNode && (
          <div className="flex items-center gap-3" style={{ padding: '6px 10px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }}>
            <span className="sk-mono" style={{ fontSize: 11, fontWeight: 600 }}>{topNode[0]}</span>
            <div className="sk-progress-track" style={{ flex: 1, maxWidth: 300, height: 6 }}>
              <div className="sk-progress-fill" style={{
                width: `${topNode[1].total > 0 ? Math.round((topNode[1].done / topNode[1].total) * 100) : 0}%`,
                background: 'var(--accent-3)',
              }} />
            </div>
            <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{topNode[1].done}/{topNode[1].total}</span>
          </div>
        )}
      </Card>
    </div>
  )
}

function MetricBadge({ label, value, sub, color, pulse }: { label: string; value: string; sub: string; color: string; pulse?: boolean }) {
  return (
    <div style={{ minWidth: 64 }}>
      <div className="sk-label sk-text-xs">{label}</div>
      <div className="sk-num" style={{ fontSize: 28, color, position: 'relative' }}>
        {value}
        {pulse && (
          <span style={{
            position: 'absolute', top: -2, right: -4,
            width: 8, height: 8, borderRadius: '50%', background: color,
            animation: 'pulse 2s infinite',
          }} />
        )}
      </div>
      <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{sub}</div>
    </div>
  )
}

export function HealthHeaderSkeleton() {
  return (
    <Card style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-6">
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--paper-2)' }} />
        <div className="flex-1 space-y-2">
          <span className="sk-bar dark" style={{ width: 120, height: 8 }} />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <span className="sk-bar dark" style={{ width: 40, height: 5 }} />
                <div style={{ marginTop: 4 }}>
                  <span className="sk-bar" style={{ width: '70%', height: 28 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
