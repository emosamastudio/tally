import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanMeta, Task } from '@/lib/types'

interface PlanRegistryProps {
  plans: PlanMeta[]
  tasks: Task[]
}

const STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  archived: '归档',
  superseded: '已替代',
}

const STATUS_CLASS: Record<string, string> = {
  active: 'ok',
  archived: '',
  superseded: 'danger',
}

function shortHash(hash: string): string {
  if (!hash) return '—'
  if (!hash.startsWith('sha256:')) return hash.slice(0, 18)
  return `sha256:${hash.slice(7, 19)}`
}

export default function PlanRegistry({ plans, tasks }: PlanRegistryProps) {
  const stats = useMemo(() => {
    const byPlan = new Map<string, {
      linkedTasks: Task[]
      staleSnapshots: Task[]
    }>()

    for (const plan of plans) {
      byPlan.set(plan.id, { linkedTasks: [], staleSnapshots: [] })
    }

    const unknownPlanTasks: Task[] = []
    const partialPlanTasks: Task[] = []

    for (const task of tasks) {
      if (!task.planRef) {
        if (task.planPath || task.planTaskRef || task.planContentHash) partialPlanTasks.push(task)
        continue
      }

      const entry = byPlan.get(task.planRef)
      if (!entry) {
        unknownPlanTasks.push(task)
        continue
      }

      entry.linkedTasks.push(task)
      const plan = plans.find((p) => p.id === task.planRef)
      if (plan && task.planContentHash && task.planContentHash !== plan.contentHash) {
        entry.staleSnapshots.push(task)
      }
    }

    const staleSnapshotCount = [...byPlan.values()].reduce((sum, item) => sum + item.staleSnapshots.length, 0)

    return {
      byPlan,
      linkedCount: [...byPlan.values()].reduce((sum, item) => sum + item.linkedTasks.length, 0),
      staleSnapshotCount,
      unknownPlanTasks,
      partialPlanTasks,
    }
  }, [plans, tasks])

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>实施计划</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>暂无注册计划</p>
          <p className="sk-body" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
            使用 <code className="sk-mono" style={{ fontSize: 11 }}>tally plan register docs/superpowers/plans/&lt;plan&gt;.md</code> 注册 Superpowers 计划。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CardHeader className="pb-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <CardTitle>实施计划</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <span className="sk-chip sk-text-xs">{plans.length} 个计划</span>
            <span className="sk-chip sk-text-xs">{stats.linkedCount} 个任务绑定</span>
            <span className={`sk-chip sk-text-xs ${stats.staleSnapshotCount > 0 ? 'danger' : 'ok'}`}>
              {stats.staleSnapshotCount} 个任务快照漂移
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="sk-box thin" style={{ padding: 10, background: 'var(--paper-2)' }}>
          <div className="sk-label sk-text-xs">文件漂移检查</div>
          <p className="sk-body sk-text-sm" style={{ color: 'var(--ink-3)', marginTop: 4 }}>
            Dashboard 只读取账本，不能直接读 plan 文件内容。请运行{' '}
            <code className="sk-mono" style={{ fontSize: 12 }}>tally plan check --json</code>
            {' '}检查 plan 文件是否缺失或 hash 是否变化。
          </p>
        </div>

        {(stats.unknownPlanTasks.length > 0 || stats.partialPlanTasks.length > 0) && (
          <div className="sk-box thin dashed" style={{ padding: 10 }}>
            <div className="sk-label sk-text-xs">需要处理</div>
            {stats.unknownPlanTasks.length > 0 && (
              <p className="sk-body sk-text-sm" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {stats.unknownPlanTasks.length} 个任务引用了未注册 plan。
              </p>
            )}
            {stats.partialPlanTasks.length > 0 && (
              <p className="sk-body sk-text-sm" style={{ color: 'var(--ink-3)', marginTop: 4 }}>
                {stats.partialPlanTasks.length} 个任务有 plan 元数据但缺少 planRef。
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {plans.map((plan) => {
            const entry = stats.byPlan.get(plan.id)
            const linkedTasks = entry?.linkedTasks ?? []
            const staleSnapshots = entry?.staleSnapshots ?? []
            return (
              <div
                key={plan.id}
                className="sk-box thin"
                style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="sk-mono sk-text-sm" style={{ fontWeight: 700 }}>{plan.id}</span>
                      <span className={`sk-chip sk-text-xs ${STATUS_CLASS[plan.status] ?? ''}`}>
                        {STATUS_LABEL[plan.status] ?? plan.status}
                      </span>
                      <span className="sk-chip sk-text-xs">{plan.kind}</span>
                    </div>
                    <div className="sk-body sk-text-base" style={{ marginTop: 4 }}>{plan.title}</div>
                    <div className="sk-mono sk-text-xs truncate" style={{ color: 'var(--ink-3)', marginTop: 2 }}>
                      {plan.path}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <span className="sk-chip sk-text-xs">{linkedTasks.length} 任务</span>
                    <span className={`sk-chip sk-text-xs ${staleSnapshots.length > 0 ? 'danger' : 'ok'}`}>
                      {staleSnapshots.length} 快照漂移
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap sk-mono sk-text-xs" style={{ color: 'var(--ink-4)' }}>
                  <span>{shortHash(plan.contentHash)}</span>
                  {plan.requiredSkill && <span>{plan.requiredSkill}</span>}
                  <span>更新 {plan.updatedAt.slice(0, 10)}</span>
                </div>

                {linkedTasks.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {linkedTasks.slice(0, 12).map((task) => (
                      <span key={task.id} className="sk-chip sk-text-xs" title={task.name}>
                        {task.id}{task.planTaskRef ? ` · ${task.planTaskRef}` : ''}
                      </span>
                    ))}
                    {linkedTasks.length > 12 && (
                      <span className="sk-chip sk-text-xs">+{linkedTasks.length - 12}</span>
                    )}
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

export function PlanRegistrySkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>实施计划</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sk-box thin" style={{ height: 54, opacity: 0.45 }} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
