import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ChartSkeleton() {
  return (
    <div className="sk-box" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="sk-body" style={{ color: 'var(--ink-4)' }}>加载图表中...</span>
    </div>
  )
}

function PageSkeleton({ title, height }: { title: string; height: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          style={{
            height,
            background: 'var(--paper-2)',
            borderRadius: 'var(--sk-radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="sk-body" style={{ color: 'var(--ink-4)' }}>加载中...</span>
        </div>
      </CardContent>
    </Card>
  )
}

function withLazy<T extends object>(factory: () => Promise<{ default: ComponentType<T> }>) {
  const Lazy = lazy(factory)
  return (props: T) => (
    <Suspense fallback={<ChartSkeleton />}>
      <Lazy {...props} />
    </Suspense>
  )
}

// Lazy wrappers
export const LazyRoundAnalytics = withLazy(() => import('./round-analytics'))
export const LazyAgentContribution = withLazy(() => import('./agent-contribution'))
export const LazyFeatureProgress = withLazy(() => import('./feature-progress'))

// Skeletons (extracted here so App.tsx doesn't eagerly import the chart modules)
export function RoundAnalyticsSkeleton() {
  return <PageSkeleton title="回合分析" height={260} />
}

export function AgentContributionSkeleton() {
  return <PageSkeleton title="Agent 贡献" height={260} />
}

export function FeatureProgressSkeleton() {
  return <PageSkeleton title="功能进度" height={260} />
}
