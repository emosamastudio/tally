// src/components/task-table.tsx
import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Task, TaskStatus, TaskSource, Priority } from '@/lib/types'

interface TaskTableProps {
  tasks: Task[]
}

const PRIORITY_LABEL: Record<Priority, string> = { P0: 'P0', P1: 'P1', P2: 'P2' }

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待处理',
  blocked: '阻塞',
  hold: 'Hold',
  deferred: '暂缓',
}

const STATUS_CHIP: Record<TaskStatus, string> = {
  completed: 'ok',
  in_progress: 'accent',
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

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 30

function TaskRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer"
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
          <TableCell colSpan={9} style={{ background: 'var(--paper-2)', padding: '14px 24px' }}>
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

              {/* Dependencies */}
              {task.dependencies.length > 0 && (
                <div>
                  <span className="sk-label" style={{ fontSize: 10 }}>依赖关系</span>
                  <p className="sk-mono" style={{ fontSize: 11, marginTop: 2 }}>
                    {task.dependencies.join(', ')}
                  </p>
                </div>
              )}

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

export default function TaskTable({ tasks }: TaskTableProps) {
  const [source, setSource] = useState<'all' | TaskSource>('all')
  const [status, setStatus] = useState<'all' | TaskStatus>('all')
  const [stage, setStage] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

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
      if (search) {
        const q = search.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tasks, source, status, stage, moduleFilter, search])

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

  const completionRate = tasks.length > 0
    ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100)
    : 0

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedData = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  )

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
        <div className="flex flex-wrap gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | TaskSource)}
            className="sk-select"
          >
            <option value="all">全部来源</option>
            <option value="os">OS</option>
            <option value="app">App</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | TaskStatus)}
            className="sk-select"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="blocked">阻塞</option>
            <option value="hold">Hold</option>
            <option value="completed">已完成</option>
          </select>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="sk-select"
          >
            <option value="">全部阶段</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="sk-select"
          >
            <option value="">全部模块</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[160px]">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>阶段</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>依赖</TableHead>
                  <TableHead>下一步 / 证据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </TableBody>
            </Table>

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
            <div key={i} style={{ padding: '8px 4px', borderBottom: '1.2px dashed rgba(0,0,0,0.25)' }}>
              <span className="sk-bar" style={{ width: `${60 + (i % 3) * 20}%`, height: 7 }} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
