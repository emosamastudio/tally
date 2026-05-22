// src/components/attention-panel.tsx
import { useState, useMemo } from 'react'
import { NavContext } from '@/components/dashboard-layout'
import { useContext } from 'react'
import { Card } from '@/components/ui/card'
import type { Task, BlockItem } from '@/lib/types'
import { useL2Navigation, l2FocusStyle } from '@/hooks/useL2Navigation'

interface AttentionPanelProps {
  tasks: Task[]
  blocks: BlockItem[]
  sectionId?: string
}

interface AttentionItem {
  type: 'blocked' | 'drift' | 'unapproved'
  taskId: string
  taskName: string
  detail: string
  action: string
}

function buildItems(tasks: Task[]): AttentionItem[] {
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

  return items
}

/** Descriptor for a single visible row in the panel. */
type PanelRow =
  | { kind: 'item'; item: AttentionItem }
  | { kind: 'drift-summary'; detail: string; count: number; childItems: AttentionItem[] }
  | { kind: 'overflow-fold'; count: number }

const MAX_VISIBLE = 5

const typeIcon: Record<string, string> = { blocked: '⊘', drift: '⚠', unapproved: '!' }
const typeColor: Record<string, string> = { blocked: 'var(--danger)', drift: 'var(--accent)', unapproved: 'var(--accent-2)' }

export default function AttentionPanel({ tasks, sectionId }: AttentionPanelProps) {
  const items = useMemo(() => buildItems(tasks), [tasks])
  const nav = useContext(NavContext)

  const [expandedDrifts, setExpandedDrifts] = useState<Record<string, boolean>>({})
  const [showAllOverflow, setShowAllOverflow] = useState(false)

  // Separate items by type
  const blockedItems = items.filter((i) => i.type === 'blocked')
  const unapprovedItems = items.filter((i) => i.type === 'unapproved')

  // Group drift items by detail message
  const driftGroups = new Map<string, AttentionItem[]>()
  for (const item of items.filter((i) => i.type === 'drift')) {
    const existing = driftGroups.get(item.detail)
    if (existing) existing.push(item)
    else driftGroups.set(item.detail, [item])
  }

  // Build the flat list of top-level rows
  const panelRows = useMemo((): PanelRow[] => {
    const rows: PanelRow[] = []

    // Blocked items: always individual
    for (const item of blockedItems) {
      rows.push({ kind: 'item', item })
    }

    // Drift summaries (one per detail type)
    for (const [detail, childItems] of driftGroups) {
      rows.push({ kind: 'drift-summary', detail, count: childItems.length, childItems })
    }

    // Unapproved items: always individual
    for (const item of unapprovedItems) {
      rows.push({ kind: 'item', item })
    }

    return rows
  }, [blockedItems, unapprovedItems, driftGroups])

  const needsFold = panelRows.length > MAX_VISIBLE
  const visibleRows = needsFold && !showAllOverflow ? panelRows.slice(0, MAX_VISIBLE) : panelRows
  const hiddenCount = Math.max(0, panelRows.length - MAX_VISIBLE)

  // Build flat nav item IDs from visible rows
  const navItemIds = useMemo((): string[] => {
    const ids: string[] = []

    for (const row of visibleRows) {
      if (row.kind === 'item') {
        ids.push(`attn-item-${row.item.taskId}`)
      } else if (row.kind === 'drift-summary') {
        ids.push(`attn-drift-summary-${row.detail}`)
        if (expandedDrifts[row.detail]) {
          for (const child of row.childItems) {
            ids.push(`attn-drift-child-${child.taskId}`)
          }
        }
      }
    }

    if (needsFold && !showAllOverflow) {
      ids.push('attn-overflow-fold')
    }

    return ids
  }, [visibleRows, expandedDrifts, needsFold, showAllOverflow])

  const { isL2, focusedIndex } = useL2Navigation(sectionId ?? '__none__', navItemIds)

  if (items.length === 0) {
    return (
      <Card style={{ padding: '10px 16px' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--accent-3)', fontSize: 16 }}>{'✓'}</span>
          <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>无需关注的事项</span>
        </div>
      </Card>
    )
  }

  // --- Render ---

  const rendered: React.ReactNode[] = []
  let slotIdx = 0

  for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx++) {
    const row = visibleRows[rowIdx]
    const isLastTopRow = rowIdx === visibleRows.length - 1 && !(needsFold && !showAllOverflow)

    if (row.kind === 'item') {
      const item = row.item
      const isLastSlot = isLastTopRow
      rendered.push(
        <div
          key={`attn-item-${item.taskId}`}
          data-nav-item={`attn-item-${item.taskId}`}
          className="flex items-baseline gap-2"
          style={{
            padding: '3px 0',
            borderBottom: isLastSlot ? 'none' : '1px solid var(--ink-4)',
            ...l2FocusStyle(isL2 && focusedIndex === slotIdx),
          }}
        >
          <span className="sk-mono" style={{ fontSize: 14, color: typeColor[item.type], width: 16, textAlign: 'center', flexShrink: 0 }}>{typeIcon[item.type]}</span>
          <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={(e) => { e.stopPropagation(); nav?.navigateToTask?.(item.taskId) }}
            title={`在任务表中查看 ${item.taskId}`}>{item.taskId}</span>
          <span className="sk-body truncate" style={{ fontSize: 11, flex: 1 }}>{item.taskName}</span>
          <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', maxWidth: 200, textAlign: 'right' }}>{item.detail}</span>
          <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-4)', cursor: 'pointer' }} title={item.action}>{'📋'}</span>
        </div>,
      )
      slotIdx++
    } else if (row.kind === 'drift-summary') {
      const isExpanded = expandedDrifts[row.detail] ?? false
      const hasChildrenAfter = isExpanded && row.childItems.length > 0
      const isLastSlot = isLastTopRow && !hasChildrenAfter

      // The summary row
      rendered.push(
        <div
          key={`attn-drift-summary-${row.detail}`}
          data-nav-item={`attn-drift-summary-${row.detail}`}
          className="flex items-baseline gap-2"
          style={{
            padding: '3px 0',
            borderBottom: isLastSlot ? 'none' : '1px solid var(--ink-4)',
            cursor: 'pointer',
            ...l2FocusStyle(isL2 && focusedIndex === slotIdx),
          }}
          onClick={() => setExpandedDrifts((prev) => ({ ...prev, [row.detail]: !isExpanded }))}
        >
          <span className="sk-mono" style={{ fontSize: 14, color: typeColor['drift'], width: 16, textAlign: 'center', flexShrink: 0 }}>{typeIcon['drift']}</span>
          <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="sk-body truncate" style={{ fontSize: 11, flex: 1, fontWeight: 600 }}>
            {row.count} 个任务{row.detail}
          </span>
        </div>,
      )
      slotIdx++

      // Expanded child items
      if (isExpanded) {
        for (let j = 0; j < row.childItems.length; j++) {
          const child = row.childItems[j]
          const isLastChild = j === row.childItems.length - 1 && isLastTopRow
          rendered.push(
            <div
              key={`attn-drift-child-${child.taskId}`}
              data-nav-item={`attn-drift-child-${child.taskId}`}
              className="flex items-baseline gap-2"
              style={{
                padding: '3px 0',
                paddingLeft: 28,
                borderBottom: isLastChild ? 'none' : '1px solid var(--ink-4)',
                ...l2FocusStyle(isL2 && focusedIndex === slotIdx),
              }}
            >
              <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48 }}>{child.taskId}</span>
              <span className="sk-body truncate" style={{ fontSize: 11, flex: 1 }}>{child.taskName}</span>
              <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-4)', cursor: 'pointer' }} title={child.action}>{'📋'}</span>
            </div>,
          )
          slotIdx++
        }
      }
    }
  }

  // Overflow fold
  if (needsFold && !showAllOverflow) {
    rendered.push(
      <div
        key="attn-overflow-fold"
        data-nav-item="attn-overflow-fold"
        className="flex items-center gap-2"
        style={{
          padding: '4px 0',
          borderTop: '1px solid var(--ink-4)',
          cursor: 'pointer',
          color: 'var(--accent)',
          ...l2FocusStyle(isL2 && focusedIndex === slotIdx),
        }}
        onClick={() => setShowAllOverflow(true)}
      >
        <span className="sk-mono" style={{ fontSize: 12 }}>{'▶'}</span>
        <span className="sk-body" style={{ fontSize: 11 }}>还有 {hiddenCount} 项...</span>
      </div>,
    )
    // slotIdx++ not needed here, fold is last element
  }

  // Collapse button when all rows are shown
  if (needsFold && showAllOverflow) {
    rendered.push(
      <div
        key="attn-collapse"
        className="flex items-center gap-2"
        style={{
          padding: '4px 0',
          borderTop: '1px solid var(--ink-4)',
          cursor: 'pointer',
          color: 'var(--ink-3)',
        }}
        onClick={() => setShowAllOverflow(false)}
      >
        <span className="sk-mono" style={{ fontSize: 12 }}>{'▲'}</span>
        <span className="sk-body" style={{ fontSize: 11 }}>收起</span>
      </div>,
    )
  }

  return (
    <Card style={{ padding: '12px 16px', borderLeft: items.length > 0 ? '3px solid var(--danger)' : '3px solid var(--accent-3)' }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="sk-h3" style={{ fontSize: 14 }}>需要关注 &middot; {items.length} 项</h3>
        <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
          {'⊘'}阻塞 {'⚠'}漂移 !未审批
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rendered}
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
