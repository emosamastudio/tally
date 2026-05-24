// src/components/overview-panel.tsx
import HealthHeader from '@/components/health-header'
import AttentionPanel from '@/components/attention-panel'
import { NavContext } from '@/components/dashboard-layout'
import { useContext } from 'react'
import type { Task, Round, BlockItem, FeatureMeta } from '@/lib/types'

function relativeDate(dateStr: string): string {
  const today = new Date()
  const d = new Date(dateStr)
  const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return dateStr
}

interface OverviewPanelProps {
  tasks: Task[]
  activeRound: Round | null
  blocks: BlockItem[]
  features: FeatureMeta[]
  sectionId?: string
  rounds?: Round[]
}

export default function OverviewPanel({ tasks, activeRound, blocks, features, sectionId, rounds }: OverviewPanelProps) {
  const nav = useContext(NavContext)
  // Recent completions: last 5 done tasks
  const recentDone = tasks
    .filter((t) => t.status === 'completed' && t.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5)

  // Active agents from rounds
  const activeAgents = (rounds ?? []).filter((r) => r.status === 'active').map((r) => ({
    executor: r.executor,
    roundId: r.id,
    scope: r.scope,
    done: r.tasks.filter((rt) => {
      const task = tasks.find((t) => t.id === rt.taskId || t.id === rt.taskId.replace(/^[UD]-/, 'D-') || t.id === rt.taskId.replace(/^[UD]-/, 'U-'))
      return task?.status === 'completed'
    }).length,
    total: r.tasks.length,
  }))

  // Delta: compare with previous progress point if available
  // (simplified: show counts as-is since we don't have yesterday's snapshot in-memory)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      {/* Row 1: Health + Metrics */}
      <HealthHeader tasks={tasks} activeRound={activeRound} blocks={blocks} features={features} />

      {/* Row 2: Attention Panel — most actionable, right after health */}
      <AttentionPanel tasks={tasks} blocks={blocks} sectionId={sectionId} />

      {/* Row 3: Active Agents (compact) */}
      {activeAgents.length > 0 && (
        <div style={{
          padding: '10px 16px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)',
          border: '1.6px solid var(--ink)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <span className="sk-label" style={{ fontSize: 11 }}>活跃</span>
          {activeAgents.map((a) => (
            <span key={a.executor} className="flex items-center gap-2">
              <span className="sk-mono" style={{ fontSize: 11, fontWeight: 600 }}>{a.executor}</span>
              <span className="sk-chip" style={{ fontSize: 9, background: a.done === a.total ? 'var(--accent-3)' : 'var(--accent-2)', color: 'var(--paper)' }}>
                {a.done}/{a.total}
              </span>
              <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{a.scope}</span>
            </span>
          ))}
          {activeAgents.length === 0 && (
            <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>暂无活跃 Agent</span>
          )}
        </div>
      )}

      {/* Row 3: Recent Activity */}
      {recentDone.length > 0 && (
        <div style={{
          padding: '10px 16px', background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)',
          border: '1.6px solid var(--ink)',
        }}>
          <div className="sk-label" style={{ fontSize: 11, marginBottom: 6 }}>最近完成</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {recentDone.map((t) => (
              <div key={t.id} className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--accent-3)', fontSize: 14 }}>✓</span>
                <span className="sk-mono" style={{ color: 'var(--ink-3)', minWidth: 48, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => nav?.navigateToTask?.(t.id)}
                  title="在任务表中查看">{t.id}</span>
                <span className="sk-body truncate" style={{ flex: 1, color: 'var(--ink-2)' }}>{t.name}</span>
                <span className="sk-mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{relativeDate(t.completedAt ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 4: Attention Panel */}
      <AttentionPanel tasks={tasks} blocks={blocks} sectionId={sectionId} />
    </div>
  )
}
