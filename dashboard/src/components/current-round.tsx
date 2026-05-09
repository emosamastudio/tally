// src/components/current-round.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Round } from '@/lib/types'

interface CurrentRoundProps {
  round: Round | null
}

export default function CurrentRound({ round }: CurrentRoundProps) {
  if (!round) {
    return (
      <Card tilt={1}>
        <CardHeader>
          <CardTitle>当前回合</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)' }}>无活跃回合</p>
        </CardContent>
      </Card>
    )
  }

  const isActive = round.status === 'active'
  const doneCount = round.tasks.length
  const totalCount = round.tasks.length

  return (
    <Card tilt={1} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">当前回合</h3>
        <span className={`sk-chip ${isActive ? 'accent' : 'ok'}`}>
          {isActive ? '进行中' : '已完成'}
        </span>
      </div>

      <div className="min-w-0">
        <div className="sk-body truncate" style={{ fontSize: 13 }}>{round.id}</div>
        <div className="sk-label truncate" style={{ fontSize: 11, marginTop: 2 }}>{round.startDate} · {round.executor}</div>
      </div>

      {/* Progress ring */}
      <div className="flex items-center gap-4 mt-2">
        <svg width="80" height="80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--ink-4)" strokeWidth="6" strokeDasharray="3 3" />
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--ink)" strokeWidth="5"
            strokeDasharray={`${0.62 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
            transform="rotate(-90 40 40)" strokeLinecap="round" />
          <text x="40" y="46" textAnchor="middle" style={{ fontFamily: 'Caveat, cursive', fontSize: 24, fontWeight: 700, fill: 'var(--ink)' }}>
            {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
          </text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="sk-body" style={{ fontSize: 12 }}>
            任务 · <b>{doneCount}/{totalCount}</b>
          </div>
          {round.scope && (
            <div className="sk-body truncate" style={{ fontSize: 12 }}>{round.scope}</div>
          )}
        </div>
      </div>

      {round.tasks.length > 0 && (
        <>
          <hr className="sk-rule dashed" style={{ margin: '4px 0' }} />
          <div className="sk-label" style={{ fontSize: 11 }}>回合任务</div>
          <div className="flex flex-col gap-1.5">
            {round.tasks.map((rt) => (
              <div key={rt.taskId} className="flex items-start gap-2">
                <span className="sk-chip" style={{ fontSize: 10, flexShrink: 0 }}>{rt.taskId}</span>
                <span className="sk-body" style={{ fontSize: 12 }}>{rt.goal}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Phase chips */}
      <hr className="sk-rule dashed" style={{ margin: '4px 0' }} />
      <div className="sk-label" style={{ fontSize: 11 }}>阶段</div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="sk-chip solid" style={{ fontSize: 10 }}>规划 ✓</span>
        <span className="sk-chip solid" style={{ fontSize: 10 }}>设计 ✓</span>
        <span className="sk-chip accent" style={{ fontSize: 10 }}>实现 ●</span>
        <span className="sk-chip" style={{ fontSize: 10 }}>校验</span>
        <span className="sk-chip" style={{ fontSize: 10 }}>收尾</span>
      </div>
    </Card>
  )
}

export function CurrentRoundSkeleton() {
  return (
    <Card tilt={1}>
      <div className="flex justify-between">
        <h3 className="sk-h3">当前回合</h3>
      </div>
      <div className="space-y-3 mt-3">
        <span className="sk-bar long dark" style={{ height: 7 }} />
        <span className="sk-bar med" style={{ height: 6 }} />
        <div className="h-20" style={{ background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)' }} />
      </div>
    </Card>
  )
}
