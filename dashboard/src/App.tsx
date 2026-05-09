// src/App.tsx
import { useLedgerData } from '@/hooks/useLedgerData'
import DashboardLayout from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import OverviewBar, { OverviewBarSkeleton } from '@/components/overview-bar'
import ProgressTrend, { ProgressTrendSkeleton } from '@/components/progress-trend'
import CurrentRound, { CurrentRoundSkeleton } from '@/components/current-round'
import StageMatrix, { StageMatrixSkeleton } from '@/components/stage-matrix'
import BlockList, { BlockListSkeleton } from '@/components/block-list'
import TaskTable, { TaskTableSkeleton } from '@/components/task-table'
import DependencyGraph, { DependencyGraphSkeleton } from '@/components/dependency-graph'
import RoundTimeline, { RoundTimelineSkeleton } from '@/components/round-timeline'

export default function App() {
  const state = useLedgerData()

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <DashboardLayout
        header={
          <div className="flex items-center justify-between w-full gap-4">
            <div className="shrink-0">
              <h1 className="sk-h1" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
              <p className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)', maxWidth: 300 }}>加载中...</p>
            </div>
            <div className="flex gap-2">
              <span className="sk-chip">单人监控</span>
              <span className="sk-chip solid">● 实时</span>
            </div>
          </div>
        }
        overview={<OverviewBarSkeleton />}
        progressTrend={<ProgressTrendSkeleton />}
        currentRound={<CurrentRoundSkeleton />}
        stageMatrix={<StageMatrixSkeleton />}
        blockList={<BlockListSkeleton />}
        dependencyGraph={<DependencyGraphSkeleton />}
        taskTable={<TaskTableSkeleton />}
        roundTimeline={<RoundTimelineSkeleton />}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <div className="sk-board" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="sk-grid" />
        <Card className="max-w-lg" dashed style={{ zIndex: 1 }}>
          <CardContent className="p-8">
            <h1 className="sk-h1" style={{ color: 'var(--danger)' }}>数据加载失败</h1>
            <p className="sk-body" style={{ fontSize: 13, marginTop: 8 }}>{state.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { merged, os, rounds, modules } = state.data
  const allTasks = os.tasks

  return (
    <DashboardLayout
      header={
        <div className="flex items-center justify-between w-full gap-4 flex-wrap">
          <div className="flex items-baseline gap-4 min-w-0 flex-wrap">
            <h1 className="sk-h1 shrink-0" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
            <span className="sk-chip shrink-0">v · 经典驾驶舱</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="sk-chip">单人监控</span>
            <span className="sk-chip solid">● 实时</span>
          </div>
        </div>
      }
      overview={<OverviewBar data={merged} tasks={allTasks} modules={modules} />}
      progressTrend={<ProgressTrend osHistory={os.progressHistory} appHistory={state.data.app.progressHistory} />}
      currentRound={<CurrentRound round={merged.activeRound} />}
      stageMatrix={<StageMatrix stages={merged.allStages} />}
      blockList={<BlockList blocks={merged.activeBlocks} />}
      dependencyGraph={<DependencyGraph tasks={allTasks} />}
      taskTable={<TaskTable tasks={allTasks} />}
      roundTimeline={<RoundTimeline rounds={rounds} tasks={allTasks} />}
    />
  )
}
