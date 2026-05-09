// src/components/stage-matrix.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StageStatus } from '@/lib/types'

interface StageMatrixProps {
  stages: StageStatus[]
  onStageClick?: (stageId: string) => void
}

function barColor(done: number, total: number): string {
  if (total === 0) return 'var(--ink-4)'
  const ratio = done / total
  if (ratio >= 0.9) return 'var(--accent-3)'
  if (ratio >= 0.5) return 'var(--accent)'
  return 'var(--accent-2)'
}

export default function StageMatrix({ stages, onStageClick }: StageMatrixProps) {
  const sorted = [...stages].sort((a, b) => a.stageId.localeCompare(b.stageId))

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>阶段矩阵</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>无阶段数据</p>
        </CardContent>
      </Card>
    )
  }

  const totalTasks = sorted.reduce((sum, s) => sum + s.done + s.open + s.hold + s.blocked, 0)

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">阶段矩阵</h3>
        <div className="sk-body" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {totalTasks} 任务 · 跨 {sorted.length} 阶段
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex" style={{ minWidth: sorted.length * 110, position: 'relative' }}>
          {sorted.map((s, i, arr) => {
            const total = s.done + s.open + s.hold + s.blocked
            const ratio = total > 0 ? s.done / total : 0
            return (
              <button
                key={s.stageId}
                onClick={() => onStageClick?.(s.stageId)}
                className="text-left shrink-0"
                style={{
                  width: 110,
                  padding: '8px 12px',
                  borderRight: i < arr.length - 1 ? '1.6px dashed var(--ink-4)' : 'none',
                  cursor: onStageClick ? 'pointer' : 'default',
                  background: 'transparent',
                }}
              >
                <span className="sk-h3 block truncate" style={{ fontSize: 16 }}>{s.stageId}</span>
                <div className="sk-num-sm" style={{ marginTop: 4 }}>
                  {s.done}<span style={{ fontSize: 18, color: 'var(--ink-3)' }}>/{total}</span>
                </div>
                {/* Thick progress bar */}
                <div className="sk-progress-track" style={{ marginTop: 4, height: 10 }}>
                  <div
                    className="sk-progress-fill"
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      background: barColor(s.done, total),
                    }}
                  />
                </div>
                <div className="sk-body" style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-3)' }}>
                  {s.done === total && total > 0 ? '已完成' : `${s.open} 待办 · ${s.hold} hold`}
                </div>
              </button>
            )
          })}
        </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StageMatrixSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>阶段矩阵</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex" style={{ minWidth: 7 * 110 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shrink-0" style={{ width: 110, padding: '8px 12px', borderRight: i < 6 ? '1.6px dashed var(--ink-4)' : 'none' }}>
              <span className="sk-bar dark short" style={{ height: 6 }} />
              <div style={{ marginTop: 6 }}>
                <span className="sk-bar long" style={{ height: 22 }} />
              </div>
              <div style={{ marginTop: 4 }}>
                <div className="sk-progress-track" style={{ height: 10 }} />
              </div>
            </div>
          ))}
        </div>
        </div>
      </CardContent>
    </Card>
  )
}
