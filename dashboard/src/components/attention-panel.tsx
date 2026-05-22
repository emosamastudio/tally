// src/components/attention-panel.tsx
import { useState, useMemo } from 'react'
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

function renderItemRow(item: AttentionItem, idx: number, totalVisible: number, isL2: boolean, focusedIndex: number, navItemId: string) {
  return (
    <div
      key={navItemId}
      data-nav-item={navItemId}
      className="flex items-baseline gap-2"
      style={{
        padding: '3px 0',
        borderBottom: idx < totalVisible - 1 ? '1px solid var(--ink-4)' : 'none',
        ...l2FocusStyle(isL2 && focusedIndex === idx),
      }}
    >
      <span className="sk-mono" style={{ fontSize: 14, color: typeColor[item.type], width: 16, textAlign: 'center', flexShrink: 0 }}>{typeIcon[item.type]}</span>
      <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48 }}>{item.taskId}</span>
      <span className="sk-body truncate" style={{ fontSize: 11, flex: 1 }}>{item.taskName}</span>
      <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)', maxWidth: 200, textAlign: 'right' }}>{item.detail}</span>
      <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-4)', cursor: 'pointer' }} title={item.action}>{'📋'}</span>
    </div>
  )
}

export default function AttentionPanel({ tasks, sectionId }: AttentionPanelProps) {
  const items = useMemo(() => buildItems(tasks), [tasks])

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

  // Build the flat list of visible rows (for rendering and L2 nav)
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
  const hiddenCount = panelRows.length - MAX_VISIBLE

  // Build flat nav item IDs from visible rows
  const navItemIds = useMemo((): string[] => {
    const ids: string[] = []
    let idx = 0

    for (const row of visibleRows) {
      if (row.kind === 'item') {
        ids.push(`attn-${idx}`)
        idx++
      } else if (row.kind === 'drift-summary') {
        ids.push(`attn-${idx}`)
        idx++
        if (expandedDrifts[row.detail]) {
          for (let j = 0; j < row.childItems.length; j++) {
            ids.push(`attn-drift-${row.detail}-${j}`)
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

  // --- Render helpers ---

  let globalRowIdx = 0
  const rendered: React.ReactNode[] = []

  function pushRow(node: React.ReactNode) {
    rendered.push(node)
    globalRowIdx++
  }

  const totalExpandedRows =
    visibleRows.filter((r) => r.kind === 'item').length +
    visibleRows.filter((r) => r.kind === 'drift-summary').length +
    visibleRows
      .filter((r) => r.kind === 'drift-summary')
      .reduce((sum, r) => sum + (expandedDrifts[(r as Extract<PanelRow, { kind: 'drift-summary' }>).detail] ? (r as Extract<PanelRow, { kind: 'drift-summary' }>).childItems.length : 0), 0)

  for (const row of visibleRows) {
    if (row.kind === 'item') {
      pushRow(renderItemRow(row.item, globalRowIdx, totalExpandedRows, isL2, focusedIndex, `attn-${globalRowIdx}`))
    } else if (row.kind === 'drift-summary') {
      const isExpanded = expandedDrifts[row.detail] ?? false

      // The summary row itself
      rendered.push(
        <div
          key={`attn-${globalRowIdx}`}
          data-nav-item={`attn-${globalRowIdx}`}
          className="flex items-baseline gap-2"
          style={{
            padding: '3px 0',
            borderBottom: globalRowIdx < totalExpandedRows - 1 ? '1px solid var(--ink-4)' : 'none',
            cursor: 'pointer',
            ...l2FocusStyle(isL2 && focusedIndex === globalRowIdx),
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
      globalRowIdx++

      // Expanded child items
      if (isExpanded) {
        for (let j = 0; j < row.childItems.length; j++) {
          const child = row.childItems[j]
          rendered.push(
            <div
              key={`attn-drift-${row.detail}-${j}`}
              data-nav-item={`attn-drift-${row.detail}-${j}`}
              className="flex items-baseline gap-2"
              style={{
                padding: '3px 0',
                paddingLeft: 28,
                borderBottom: j < row.childItems.length - 1 ? '1px solid var(--ink-4)' : 'none',
                ...l2FocusStyle(isL2 && focusedIndex === navItemIds.indexOf(`attn-drift-${row.detail}-${j}`)),
              }}
            >
              <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 48 }}>{child.taskId}</span>
              <span className="sk-body truncate" style={{ fontSize: 11, flex: 1 }}>{child.taskName}</span>
              <span className="sk-mono" style={{ fontSize: 9, color: 'var(--ink-4)', cursor: 'pointer' }} title={child.action}>{'📋'}</span>
            </div>,
          )
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
          ...l2FocusStyle(isL2 && focusedIndex === navItemIds.indexOf('attn-overflow-fold')),
        }}
        onClick={() => setShowAllOverflow(true)}
      >
        <span className="sk-mono" style={{ fontSize: 12 }}>{'▶'}</span>
        <span className="sk-body" style={{ fontSize: 11 }}>还有 {hiddenCount} 项...</span>
      </div>,
    )
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
    <Card style={{ padding: '12px 16px', borderLeft: '3px solid var(--danger)' }}>
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
