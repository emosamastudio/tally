// src/App.tsx
/**
 * Diagram opportunities (future):
 *
 * Already implemented:
 * - ProgressTrend: area chart (Recharts)
 * - RoundAnalytics: burndown + velocity (Recharts ComposedChart) — lazy loaded
 * - ModuleDistribution: treemap (Recharts Treemap) — lazy loaded
 * - PriorityDonut: donut chart (Recharts PieChart) — lazy loaded
 * - AgentContribution: stacked bar chart (Recharts BarChart) — lazy loaded
 * - DependencyGraph: DAG with dagre layout
 * - StageMatrix: pipeline with progress bars
 * - CurrentRound: SVG progress ring + collapsible round timeline
 * - TaskTable: inline dependency chain in expanded rows
 */
import { useState, useEffect } from 'react'
import { useLedgerData } from '@/hooks/useLedgerData'
import DashboardLayout from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorBoundary } from '@/components/error-boundary'
import OverviewBar, { OverviewBarSkeleton } from '@/components/overview-bar'
import ProgressTrend, { ProgressTrendSkeleton } from '@/components/progress-trend'
import CurrentRound, { CurrentRoundSkeleton } from '@/components/current-round'
import StageMatrix, { StageMatrixSkeleton } from '@/components/stage-matrix'
import BlockList, { BlockListSkeleton } from '@/components/block-list'
import TaskTable, { TaskTableSkeleton } from '@/components/task-table'
import DependencyGraph, { DependencyGraphSkeleton } from '@/components/dependency-graph'
import {
  LazyRoundAnalytics,
  LazyModuleDistribution,
  LazyPriorityDonut,
  LazyAgentContribution,
  RoundAnalyticsSkeleton,
  ModuleDistributionSkeleton,
  PriorityDonutSkeleton,
  AgentContributionSkeleton,
} from '@/components/lazy-wrappers'

export default function App() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const { state, projects } = useLedgerData(selectedProject)

  // Auto-select first project when multi-project mode is detected
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name)
    }
  }, [projects, selectedProject])

  // Project selector chip
  const projectSelector = projects.length > 0 ? (
    <select
      className="sk-select w-full md:w-auto"
      value={selectedProject ?? ''}
      onChange={(e) => setSelectedProject(e.target.value)}
      style={{
        fontFamily: 'inherit',
        fontSize: 12,
        padding: '4px 8px',
        border: '1px solid var(--ink-4)',
        borderRadius: 6,
        background: 'var(--surface-1)',
        color: 'var(--ink-1)',
        cursor: 'pointer',
      }}
    >
      {projects.map((p) => (
        <option key={p.name} value={p.name}>{p.name}</option>
      ))}
    </select>
  ) : null

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <DashboardLayout
        header={
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
            <div className="shrink-0">
              <h1 className="sk-h1" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
              <p className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)', maxWidth: 300 }}>加载中...</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {projectSelector}
              <span className="sk-chip">单人监控</span>
              <span className="sk-chip solid">● 实时</span>
            </div>
          </div>
        }
        overview={<OverviewBarSkeleton />}
        progressTrend={<ProgressTrendSkeleton />}
        currentRound={<CurrentRoundSkeleton />}
        roundAnalytics={<RoundAnalyticsSkeleton />}
        stageMatrix={<StageMatrixSkeleton />}
        moduleDistribution={<ModuleDistributionSkeleton />}
        priorityDonut={<PriorityDonutSkeleton />}
        blockList={<BlockListSkeleton />}
        agentContribution={<AgentContributionSkeleton />}
        dependencyGraph={<DependencyGraphSkeleton />}
        taskTable={<TaskTableSkeleton />}
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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
          <div className="flex items-baseline gap-4 min-w-0 flex-wrap">
            <h1 className="sk-h1 shrink-0" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
            <span className="sk-chip shrink-0">v · 经典驾驶舱</span>
          </div>
          <div className="flex gap-2 shrink-0 items-center flex-wrap">
            {projectSelector}
            <span className="sk-chip">单人监控</span>
            <span className="sk-chip solid">● 实时</span>
          </div>
        </div>
      }
      overview={
        <ErrorBoundary fallbackName="概览">
          <OverviewBar data={merged} tasks={allTasks} modules={modules} />
        </ErrorBoundary>
      }
      progressTrend={
        <ErrorBoundary fallbackName="进度趋势">
          <ProgressTrend osHistory={os.progressHistory} appHistory={state.data.app.progressHistory} />
        </ErrorBoundary>
      }
      currentRound={
        <ErrorBoundary fallbackName="当前回合">
          <CurrentRound round={merged.activeRound} allRounds={rounds} allTasks={allTasks} />
        </ErrorBoundary>
      }
      roundAnalytics={
        <ErrorBoundary fallbackName="回合分析">
          <LazyRoundAnalytics rounds={rounds} tasks={allTasks} />
        </ErrorBoundary>
      }
      stageMatrix={
        <ErrorBoundary fallbackName="阶段矩阵">
          <StageMatrix stages={merged.allStages} />
        </ErrorBoundary>
      }
      moduleDistribution={
        <ErrorBoundary fallbackName="模块分布">
          <LazyModuleDistribution tasks={allTasks} />
        </ErrorBoundary>
      }
      priorityDonut={
        <ErrorBoundary fallbackName="优先级分布">
          <LazyPriorityDonut tasks={allTasks} />
        </ErrorBoundary>
      }
      blockList={
        <ErrorBoundary fallbackName="阻塞列表">
          <BlockList blocks={merged.activeBlocks} />
        </ErrorBoundary>
      }
      agentContribution={
        <ErrorBoundary fallbackName="代理贡献">
          <LazyAgentContribution rounds={rounds} tasks={allTasks} />
        </ErrorBoundary>
      }
      dependencyGraph={
        <ErrorBoundary fallbackName="依赖图">
          <DependencyGraph tasks={allTasks} />
        </ErrorBoundary>
      }
      taskTable={
        <ErrorBoundary fallbackName="任务列表">
          <TaskTable tasks={allTasks} allTasks={allTasks} />
        </ErrorBoundary>
      }
    />
  )
}
