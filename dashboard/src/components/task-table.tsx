// src/components/task-table.tsx
import { useState, useMemo, useEffect, useCallback } from 'react'
import { NavContext } from '@/components/dashboard-layout'
import { useContext } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { l2FocusStyle } from '@/hooks/useL2Navigation'
import type { Task, TaskStatus, TaskSource, Priority } from '@/lib/types'

interface TaskTableProps {
  tasks: Task[]
  allTasks?: Task[]
}

const PRIORITY_LABEL: Record<Priority, string> = { P0: 'P0', P1: 'P1', P2: 'P2' }

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待处理',
  blocked: '阻塞',
  hold: '搁置',
  deferred: '暂缓',
}

const STATUS_CHIP: Record<TaskStatus, string> = {
  completed: 'ok',
  in_progress: 'accent-2',
  pending: '',
  blocked: 'danger',
  hold: '',
  deferred: '',
}

const PRIORITY_CHIP: Record<Priority, string> = {
  P0: 'danger',
  P1: 'accent',
  P2: '',
}

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  completed: 'var(--accent-3)',
  in_progress: 'var(--accent-2)',
  pending: 'var(--ink-4)',
  blocked: 'var(--danger)',
  hold: 'var(--ink-4)',
  deferred: 'var(--ink-4)',
}

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 30

/** BFS to find ancestors (dependencies) up to maxDepth */
function findAncestors(
  taskId: string,
  taskMap: Map<string, Task>,
  maxDepth: number,
): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const queue: { id: string; depth: number }[] = [{ id: taskId, depth: 0 }]
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id) || depth > maxDepth) continue
    visited.add(id)
    const task = taskMap.get(id)
    if (!task) continue
    if (id !== taskId) result.push(id)
    if (depth < maxDepth) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          queue.push({ id: depId, depth: depth + 1 })
        }
      }
    }
  }
  // Reverse so ancestors appear in order (root → closest)
  return result.reverse()
}

/** BFS to find descendants (dependents) up to maxDepth */
function findDescendants(
  taskId: string,
  reverseDepMap: Map<string, string[]>,
  maxDepth: number,
): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const queue: { id: string; depth: number }[] = [{ id: taskId, depth: 0 }]
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id) || depth > maxDepth) continue
    visited.add(id)
    if (id !== taskId) result.push(id)
    if (depth < maxDepth) {
      for (const depId of reverseDepMap.get(id) ?? []) {
        if (!visited.has(depId)) {
          queue.push({ id: depId, depth: depth + 1 })
        }
      }
    }
  }
  return result
}

function DepChain({
  taskId,
  taskMap,
  reverseDepMap,
  onNavigate,
}: {
  taskId: string
  taskMap: Map<string, Task>
  reverseDepMap: Map<string, string[]>
  onNavigate?: (taskId: string) => void
}) {
  const ancestors = useMemo(() => findAncestors(taskId, taskMap, 5), [taskId, taskMap])
  const descendants = useMemo(() => findDescendants(taskId, reverseDepMap, 5), [taskId, reverseDepMap])

  const hasAncestors = ancestors.length > 0
  const hasDescendants = descendants.length > 0

  if (!hasAncestors && !hasDescendants) {
    return (
      <p className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
        无依赖链 — 此任务无上下游依赖
      </p>
    )
  }

  const truncateAncestors = ancestors.length > 5
    ? [...ancestors.slice(0, 2), '...', ...ancestors.slice(-2)]
    : ancestors
  const truncateDescendants = descendants.length > 5
    ? [...descendants.slice(0, 2), '...', ...descendants.slice(-2)]
    : descendants

  const renderNode = (id: string, isCurrent: boolean) => {
    if (id === '...') {
      return (
        <span key={`ellipsis-${Math.random()}`} className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)', padding: '0 2px' }}>
          ...
        </span>
      )
    }
    const nodeTask = taskMap.get(id)
    const color = nodeTask ? STATUS_DOT_COLORS[nodeTask.status] : 'var(--ink-4)'
    return (
      <button
        key={id}
        onClick={(e) => { e.stopPropagation(); onNavigate?.(id) }}
        className="flex flex-col items-center gap-0.5"
        style={{
          background: 'none',
          border: isCurrent ? '2px solid var(--ink)' : '1.4px solid var(--ink-4)',
          borderRadius: 'var(--sk-radius)',
          padding: '2px 6px',
          cursor: onNavigate ? 'pointer' : 'default',
          minWidth: 56,
        }}
        title={nodeTask ? `${nodeTask.id}: ${nodeTask.name}` : id}
      >
        <span
          className="inline-block rounded-full shrink-0"
          style={{
            width: 8,
            height: 8,
            backgroundColor: color,
            border: isCurrent ? '1.4px solid var(--ink)' : '1px solid var(--ink-3)',
          }}
        />
        <span
          className="sk-mono"
          style={{
            fontSize: 9,
            color: isCurrent ? 'var(--ink)' : 'var(--ink-3)',
            fontWeight: isCurrent ? 700 : 400,
          }}
        >
          {id}
        </span>
      </button>
    )
  }

  const renderArrow = (key: string) => (
    <span key={key} className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)', padding: '0 1px', alignSelf: 'center' }}>
      &rarr;
    </span>
  )

  const nodes: React.ReactNode[] = []
  truncateAncestors.forEach((id, i) => {
    nodes.push(renderNode(id, false))
    if (i < truncateAncestors.length - 1) {
      nodes.push(renderArrow(`a-${id}-${i}`))
    }
  })
  if (hasAncestors) {
    nodes.push(renderArrow('pre-self'))
  }
  nodes.push(renderNode(taskId, true))
  if (hasDescendants) {
    nodes.push(renderArrow('post-self'))
  }
  truncateDescendants.forEach((id, i) => {
    nodes.push(renderNode(id, false))
    if (i < truncateDescendants.length - 1) {
      nodes.push(renderArrow(`d-${id}-${i}`))
    }
  })

  return (
    <div className="flex items-center flex-wrap gap-1" style={{ marginTop: 8 }}>
      <span className="sk-label" style={{ fontSize: 10, marginRight: 4 }}>依赖链</span>
      <div className="flex items-center flex-wrap gap-1">{nodes}</div>
    </div>
  )
}

function TaskRow({ task, taskMap, reverseDepMap, onNavigate }: {
  task: Task
  taskMap: Map<string, Task>
  reverseDepMap: Map<string, string[]>
  onNavigate?: (taskId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const nav = useContext(NavContext)

  const isFocused =
    nav != null &&
    nav.focusLevel === 2 &&
    nav.sectionId === 'task-table' &&
    nav.items[nav.focusedItemIndex] === task.id

  // L2 Enter: toggle row expansion
  useEffect(() => {
    if (!isFocused) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setExpanded((p) => !p) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isFocused])

  return (
    <>
      <TableRow
        id={`task-row-${task.id}`}
        data-nav-item={task.id}
        className="cursor-pointer"
        style={l2FocusStyle(isFocused)}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {expanded
            ? <ChevronDown size={14} style={{ color: 'var(--ink-3)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--ink-3)' }} />
          }
        </TableCell>
        <TableCell>
          <span className="sk-mono" style={{ fontSize: 11 }}>{task.id}</span>
        </TableCell>
        <TableCell className="max-w-[180px]">
          <span className="sk-body block truncate" style={{ fontSize: 13 }}>{task.name}</span>
        </TableCell>
        <TableCell>
          <span className="sk-mono block truncate" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{task.stage}</span>
        </TableCell>
        <TableCell>
          <span className="sk-mono block truncate" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{task.module}</span>
        </TableCell>
        <TableCell>
          <span className="sk-mono block truncate" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{task.feature ?? '—'}</span>
        </TableCell>
        <TableCell>
          <span className={`sk-chip shrink-0 ${PRIORITY_CHIP[task.priority]}`} style={{ fontSize: 10 }}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        </TableCell>
        <TableCell>
          <span className={`sk-chip shrink-0 ${STATUS_CHIP[task.status]}`} style={{ fontSize: 10 }}>
            {STATUS_LABEL[task.status]}
          </span>
        </TableCell>
        <TableCell>
          <span className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {task.dependencies.length > 0 ? task.dependencies.length : '—'}
          </span>
        </TableCell>
        <TableCell className="max-w-[140px]">
          <span className="sk-body block truncate" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {task.status === 'completed' ? task.evidence ?? '—' : task.nextAction ?? '—'}
          </span>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={10} style={{ background: 'var(--paper-2)', padding: '14px 24px' }}>
            <div className="space-y-3" style={{ fontSize: 12 }}>
              {/* Task name as header */}
              <div>
                <span className="sk-h3" style={{ fontSize: 18 }}>{task.name}</span>
                <div className="flex gap-2 mt-1">
                  <span className="sk-chip" style={{ fontSize: 10 }}>{task.module}</span>
                  <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{task.stage}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex gap-4">
                <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  创建 {task.createdAt ?? '—'}
                </span>
                {task.completedAt && (
                  <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    完成 {task.completedAt}
                  </span>
                )}
                {task.order != null && (
                  <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    排序 #{task.order}
                  </span>
                )}
              </div>

              <hr className="sk-rule dashed thin" />

              {/* Acceptance criteria */}
              <div>
                <span className="sk-label" style={{ fontSize: 10 }}>验收标准</span>
                <p className="sk-body" style={{ fontSize: 12, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                  {task.acceptanceCriteria || '—'}
                </p>
              </div>

              {/* Next action (for non-done tasks) */}
              {task.status !== 'completed' && task.nextAction && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>下一步</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>{task.nextAction}</p>
                </div>
              )}

              {/* Evidence (for done tasks) */}
              {task.status === 'completed' && task.evidence && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>完成证据</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>{task.evidence}</p>
                </div>
              )}

              {/* Dependency chain */}
              <DepChain
                taskId={task.id}
                taskMap={taskMap}
                reverseDepMap={reverseDepMap}
                onNavigate={onNavigate}
              />

              {/* Tags */}
              {task.tags.length > 0 && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>标签</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>
                    {task.tags.join(', ')}
                  </p>
                </div>
              )}

              {/* Blocks */}
              {task.blocks && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>阻塞 / 风险</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>{task.blocks}</p>
                </div>
              )}

              {/* Claim info */}
              {task.claimedBy && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>认领</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>
                    {task.claimedBy}{task.claimedAt ? ` · ${task.claimedAt}` : ''}
                  </p>
                </div>
              )}

              {/* Follow-up rule */}
              {task.followUpRule && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>后续规则</span>
                  <p className="sk-body" style={{ fontSize: 12, marginTop: 2 }}>{task.followUpRule}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function TaskTable({ tasks, allTasks }: TaskTableProps) {
  const [source, setSource] = useState<'all' | TaskSource>('all')
  const [status, setStatus] = useState<'all' | TaskStatus>('all')
  const [stage, setStage] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [featureFilter, setFeatureFilter] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // L2 keyboard nav: register task rows as focusable items
  const nav = useContext(NavContext)

  // Build lookup maps from allTasks (or tasks if allTasks not provided)
  const lookupTasks = allTasks ?? tasks
  const taskMap = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of lookupTasks) m.set(t.id, t)
    return m
  }, [lookupTasks])

  // Build reverse dependency map (taskId → list of tasks that depend on it)
  const reverseDepMap = useMemo(() => {
    const rev = new Map<string, string[]>()
    for (const t of lookupTasks) {
      for (const depId of t.dependencies) {
        const list = rev.get(depId)
        if (list) list.push(t.id)
        else rev.set(depId, [t.id])
      }
    }
    return rev
  }, [lookupTasks])

  const handleNavigate = useCallback((taskId: string) => {
    // Switch to Tasks category (index 3)
    nav?.focusSection(3, 0)
    // Reset filters so the task is visible
    setSource('all')
    setStatus('all')
    setStage('')
    setModuleFilter('')
    setSearch(taskId)

    // Scroll to the task row after render
    setTimeout(() => {
      const el = document.getElementById(`task-row-${taskId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }, [nav])

  // Register as global task navigator
  useEffect(() => {
    if (nav?.setNavigateToTask) {
      nav.setNavigateToTask(() => handleNavigate)
    }
  }, [nav?.setNavigateToTask, handleNavigate])

  // Reset to page 1 whenever filters or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [source, status, stage, moduleFilter, search])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (source !== 'all' && t.source !== source) return false
      if (status !== 'all' && t.status !== status) return false
      if (stage && t.stage !== stage) return false
      if (moduleFilter && t.module !== moduleFilter) return false
      if (featureFilter && t.feature !== featureFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tasks, source, status, stage, moduleFilter, featureFilter, search])

  const stages = useMemo(
    () => [...new Set(tasks.map((t) => t.stage))].sort(),
    [tasks],
  )

  const modules = useMemo(() => {
    const seen = new Set<string>()
    return tasks
      .filter((t) => { if (seen.has(t.module)) return false; seen.add(t.module); return true })
      .map((t) => ({ id: t.module, name: t.module }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [tasks])

  const features = useMemo(() => {
    const seen = new Set<string>()
    const base = moduleFilter ? tasks.filter((t) => t.module === moduleFilter) : tasks
    return base
      .filter((t) => {
        if (!t.feature || seen.has(t.feature)) return false
        seen.add(t.feature)
        return true
      })
      .map((t) => ({ id: t.feature!, name: t.feature! }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [tasks, moduleFilter])

  const completionRate = tasks.length > 0
    ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100)
    : 0

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedData = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  )

  // Register current page task IDs for L2 keyboard navigation
  useEffect(() => {
    if (nav) {
      const ids = paginatedData.map((t) => t.id)
      nav.registerItems('task-table', ids)
    }
  }, [nav, paginatedData])

  return (
    <Card thin style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <CardTitle>任务列表</CardTitle>
            <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              显示 {filtered.length} / {tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={completionRate} accent className="w-24" />
            <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{completionRate}%</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-3">
        {/* Filters as SkChip-style */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | TaskSource)}
            className="sk-select w-full sm:w-auto"
          >
            <option value="all">全部来源</option>
            <option value="os">OS</option>
            <option value="app">App</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | TaskStatus)}
            className="sk-select w-full sm:w-auto"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="blocked">阻塞</option>
            <option value="hold">搁置</option>
            <option value="deferred">暂缓</option>
            <option value="completed">已完成</option>
          </select>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="sk-select w-full sm:w-auto"
          >
            <option value="">全部阶段</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="sk-select w-full sm:w-auto"
          >
            <option value="">全部模块</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="sk-select w-full sm:w-auto"
          >
            <option value="">全部功能</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[160px]">
            <input
              type="text"
              placeholder="搜索任务..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sk-input"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0' }}>
            没有匹配当前筛选条件的任务。
          </p>
        ) : (
          <>
            <div className="max-w-[calc(100vw-2rem)] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>阶段</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead>功能</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>依赖</TableHead>
                  <TableHead>下一步 / 证据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((t) => (
                  <TaskRow key={t.id} task={t} taskMap={taskMap} reverseDepMap={reverseDepMap} onNavigate={handleNavigate} />
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="sk-select"
                style={{ fontSize: 11 }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} 条/页</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="sk-chip"
                  style={{ fontSize: 11, opacity: currentPage === 1 ? 0.3 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
                >
                  上一页
                </button>
                <span className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  第 {currentPage}/{totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="sk-chip"
                  style={{ fontSize: 11, opacity: currentPage === totalPages ? 0.3 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function TaskTableSkeleton() {
  return (
    <Card thin>
      <CardHeader>
        <CardTitle>任务列表</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="sk-chip">
              <span className="sk-bar dark" style={{ width: 50, height: 5 }} />
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: '8px 4px', borderBottom: '1.2px dashed rgba(var(--grid-line), 0.25)' }}>
              <span className="sk-bar" style={{ width: `${60 + (i % 3) * 20}%`, height: 7 }} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
