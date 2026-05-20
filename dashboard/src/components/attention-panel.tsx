// src/components/attention-panel.tsx
import { Card } from '@/components/ui/card'
import type { Task, BlockItem } from '@/lib/types'

interface AttentionPanelProps {
  tasks: Task[]
  blocks: BlockItem[]
}

interface AttentionItem {
  type: 'blocked' | 'drift' | 'unapproved'
  taskId: string
  taskName: string
  detail: string
  action: string
}

export default function AttentionPanel({ tasks }: AttentionPanelProps) {
  const items: AttentionItem[] = []

  // Blocked tasks
  for (const t of tasks.filter((t) => t.status === 'blocked')) {
    items.push({
      type: 'blocked',
      taskId: t.id,
      taskName: t.name,
      detail: t.blocks ?? '未指定原因',
      action: `tally task unblock ${t.id}`,
    })
  }

  // Drift: done tasks with writeScopes but no commit
  for (const t of tasks.filter((t) => t.status === 'completed')) {
    const ev = t.evidence ?? ''
    if ((t.writeScopes?.length ?? 0) > 0 && !ev.includes('[commit:')) {
      items.push({
        type: 'drift',
        taskId: t.id,
        taskName: t.name,
        detail: '缺少 [commit:] 证据',
        action: `tally task annotate ${t.id} --evidence "... [commit: <sha>]"`,
      })
    }
  }

  // Drift: requires review but no review evidence
  for (const t of tasks.filter((t) => t.status === 'completed' && t.requiresReview)) {
    const ev = t.evidence ?? ''
    if (!ev.includes('[review:')) {
      items.push({
        type: 'drift',
        taskId: t.id,
        taskName: t.name,
        detail: '需要 review 但缺少 [review:] 证据',
        action: `tally task annotate ${t.id} --evidence "... [review: <ref>]"`,
      })
    }
  }

  // Unapproved high-risk
  for (const t of tasks.filter((t) =>
    (t.riskLevel === 'high' || t.riskLevel === 'critical') && !t.approvedBy && t.status !== 'completed'
  )) {
    items.push({
      type: 'unapproved',
      taskId: t.id,
      taskName: t.name,
      detail: `${t.riskLevel} 风险未审批`,
      action: `tally task approve ${t.id} --by <name>`,
    })
  }

  if (items.length === 0) {
    return (
      <Card style={{ padding: '10px 16px' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--accent-3)', fontSize: 16 }}>✓</span>
          <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>无需关注的事项</span>
        </div>
      </Card>
    )
  }

  const typeIcon: Record<string, string> = { blocked: '⊘', drift: '⚠', unapproved: '!' }
  const typeColor: Record<string, string> = { blocked: 'var(--danger)', drift: 'var(--accent)', unapproved: 'var(--accent-2)' }

  return (
    <Card style={{ padding: '12px 16px', borderLeft: '3px solid var(--danger)' }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="sk-h3" style={{ fontSize: 14 }}>需要关注 · {items.length} 项</h3>
        <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
          ⊘阻塞 ⚠漂移 !未审批
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline gap-2" style={{ padding: '3px 0', borderBottom: i < items.length - 1 ? '1px solid var(--ink-4)' : 'none' }}>
            <span className="sk-mono" style={{ fontSize: 14, color: typeColor[item.type], width: 16, textAlign: 'center', flexShrink: 0 }}>{typeIcon[item.type]}</span>
            <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48 }}>{item.taskId}</span>
            <span className="sk-body truncate" style={{ fontSize: 11, flex: 1 }}>{item.taskName}</span>
            <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', maxWidth: 200, textAlign: 'right' }}>{item.detail}</span>
            <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-4)', cursor: 'pointer' }} title={item.action}>📋</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function AttentionPanelSkeleton() {
  return (
    <Card style={{ padding: '12px 16px' }}>
      <span className="sk-bar dark" style={{ width: 120, height: 7 }} />
      <div className="space-y-2 mt-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2">
            <span className="sk-bar" style={{ width: 14, height: 14 }} />
            <span className="sk-bar" style={{ flex: 1, height: 12 }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
