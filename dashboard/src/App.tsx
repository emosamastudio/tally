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
import { Sun, Moon } from 'lucide-react'
import { useLedgerData } from '@/hooks/useLedgerData'
import DashboardLayout from '@/components/dashboard-layout'
import type { NavCategory } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorBoundary } from '@/components/error-boundary'
import OverviewPanel from '@/components/overview-panel'
import { HealthHeaderSkeleton } from '@/components/health-header'
import ProgressTrend, { ProgressTrendSkeleton } from '@/components/progress-trend'
import CurrentRound, { CurrentRoundSkeleton } from '@/components/current-round'
import StageMatrix, { StageMatrixSkeleton } from '@/components/stage-matrix'
import TaskTable, { TaskTableSkeleton } from '@/components/task-table'
import DependencyGraph, { DependencyGraphSkeleton } from '@/components/dependency-graph'
import AgentActivity, { AgentActivitySkeleton } from '@/components/agent-activity'
import RoundTimeline from '@/components/round-timeline'
import FeatureDeps from '@/components/feature-deps'
import {
  LazyRoundAnalytics,
  LazyAgentContribution,
  LazyFeatureProgress,
  FeatureProgressSkeleton,
} from '@/components/lazy-wrappers'

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}


export default function App() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [refreshKey, _setRefreshKey] = useState(0)
  const { state, projects, lastRefreshed } = useLedgerData(selectedProject, refreshKey)

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('tally-theme') as 'light' | 'dark') ?? 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tally-theme', theme)
  }, [theme])

  // Auto-select first project when multi-project mode is detected
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name)
    }
  }, [projects, selectedProject])

  // Theme toggle button
  const themeToggle = (
    <button
      onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      className="sk-chip"
      style={{ cursor: 'pointer' }}
      title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
      aria-label="切换深浅模式"
    >
      {theme === 'light' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
    </button>
  )

  // Refresh indicator
  const refreshIndicator = lastRefreshed ? (
    <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
      更新于 {formatTime(lastRefreshed)}
    </span>
  ) : null

  if (state.status === 'loading' || state.status === 'idle') {
    const loadingCategories: NavCategory[] = [
      { id: 'overview', label: '概览', sections: ['overview-panel', 'progress-trend'] },
      { id: 'planning', label: '规划', sections: ['stage-matrix', 'feature-progress'] },
      { id: 'execution', label: '执行', sections: ['current-round', 'agent-activity'] },
      { id: 'tasks', label: '任务', sections: ['task-table'] },
      { id: 'graphs', label: '图谱', sections: ['dependency-graph'] },
    ]
    return (
      <DashboardLayout
        header={
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
            <div className="shrink-0">
              <h1 className="sk-h1" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
              <p className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)', maxWidth: 300 }}>加载中...</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {projects.length > 0 ? (
                <select className="sk-select" value={selectedProject ?? ''} onChange={(e) => setSelectedProject(e.target.value)}>
                  {projects.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}
                </select>
              ) : (
                <span className="sk-chip shrink-0">Tally</span>
              )}
              {themeToggle}
              <span className="sk-chip">加载中</span>
            </div>
          </div>
        }
        categories={loadingCategories}
        children={{
          'overview-panel': <HealthHeaderSkeleton />,
          'progress-trend': <ProgressTrendSkeleton />,
          'stage-matrix': <StageMatrixSkeleton />,
          'feature-progress': <FeatureProgressSkeleton />,
          'current-round': <CurrentRoundSkeleton />,
          'agent-activity': <AgentActivitySkeleton />,
          'task-table': <TaskTableSkeleton />,
          'dependency-graph': <DependencyGraphSkeleton />,
        }}
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
            <p className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 12 }}>
              请确认 tally.json 存在且 CLI 服务器正在运行 (tally dashboard)
            </p>
            <button
              className="sk-chip accent"
              style={{ marginTop: 16, cursor: 'pointer', fontSize: 13, padding: '8px 20px' }}
              onClick={() => _setRefreshKey((k: number) => k + 1)}
            >
              重试
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { merged, os, rounds, features } = state.data
  const allTasks = os.tasks

  return (
    <>
      <DashboardLayout
        header={
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
            <div className="flex items-baseline gap-4 min-w-0 flex-wrap">
              <h1 className="sk-h1 shrink-0" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
              {projects.length > 0 ? (
                <select className="sk-select" value={selectedProject ?? ''} onChange={(e) => setSelectedProject(e.target.value)}>
                  {projects.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}
                </select>
              ) : (
                <span className="sk-chip shrink-0">{state.status === 'ready' ? state.data.projectName : 'Tally'}</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0 items-center flex-wrap">
              {themeToggle}
              {state.status === 'ready' && (
                <span className="sk-chip ok">{merged.totalDone}/{merged.totalDone + merged.totalOpen + merged.activeBlocks.length} 完成</span>
              )}
              {refreshIndicator}
            </div>
          </div>
        }
        categories={[
          {
            id: 'overview',
            label: '概览',
            sections: ['overview-panel', 'progress-trend'],
          },
          {
            id: 'planning',
            label: '规划',
            sections: ['stage-matrix', 'feature-progress', 'feature-deps'],
          },
          {
            id: 'execution',
            label: '执行',
            sections: ['current-round', 'agent-activity', 'round-timeline', 'round-analytics', 'agent-contribution'],
          },
          {
            id: 'tasks',
            label: '任务',
            sections: ['task-table'],
          },
          {
            id: 'graphs',
            label: '图谱',
            sections: ['dependency-graph'],
          },
        ]}
        children={{
          // 概览
          'overview-panel': (
            <ErrorBoundary fallbackName="概览">
              <OverviewPanel sectionId="overview-panel" tasks={allTasks} activeRound={merged.activeRound} blocks={merged.activeBlocks} features={features} rounds={rounds} />
            </ErrorBoundary>
          ),
          'progress-trend': (
            <ErrorBoundary fallbackName="进度趋势">
              <ProgressTrend osHistory={os.progressHistory} appHistory={state.data.app.progressHistory} />
            </ErrorBoundary>
          ),
          // 规划
          'stage-matrix': (
            <ErrorBoundary fallbackName="阶段矩阵">
              <StageMatrix stages={merged.allStages} />
            </ErrorBoundary>
          ),
          'feature-progress': (
            <ErrorBoundary fallbackName="功能进度">
              <LazyFeatureProgress features={features} tasks={allTasks} />
            </ErrorBoundary>
          ),
          'feature-deps': (
            <ErrorBoundary fallbackName="功能依赖">
              <FeatureDeps features={features} tasks={allTasks} />
            </ErrorBoundary>
          ),
          // 执行
          'current-round': (
            <ErrorBoundary fallbackName="当前回合">
              <CurrentRound round={merged.activeRound} allRounds={rounds} allTasks={allTasks} />
            </ErrorBoundary>
          ),
          'agent-activity': (
            <ErrorBoundary fallbackName="活跃Agent">
              <AgentActivity rounds={rounds} tasks={allTasks} />
            </ErrorBoundary>
          ),
          'round-timeline': (
            <ErrorBoundary fallbackName="回合时间线">
              <RoundTimeline rounds={rounds} tasks={allTasks} />
            </ErrorBoundary>
          ),
          'round-analytics': (
            <ErrorBoundary fallbackName="回合分析">
              <LazyRoundAnalytics rounds={rounds} tasks={allTasks} />
            </ErrorBoundary>
          ),
          // 任务
          'task-table': (
            <ErrorBoundary fallbackName="任务列表">
              <TaskTable tasks={allTasks} allTasks={allTasks} />
            </ErrorBoundary>
          ),
          'agent-contribution': (
            <ErrorBoundary fallbackName="Agent贡献">
              <LazyAgentContribution rounds={rounds} tasks={allTasks} />
            </ErrorBoundary>
          ),
          // 图谱
          'dependency-graph': (
            <ErrorBoundary fallbackName="依赖图">
              <DependencyGraph tasks={allTasks} />
            </ErrorBoundary>
          ),
        }}
      />
    </>
  )
}
