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
import { useState, useEffect, useCallback, useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
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

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: '?', desc: '显示/隐藏快捷键帮助' },
    { key: '/', desc: '聚焦搜索框' },
    { key: 'r', desc: '手动刷新数据' },
    { key: '1-6', desc: '跳转到对应行' },
    { key: 'Esc', desc: '关闭面板/弹窗' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="sk-box"
        style={{ minWidth: 300, maxWidth: 400, padding: '24px 28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="sk-h2">快捷键</h2>
          <button
            onClick={onClose}
            className="sk-chip"
            style={{ cursor: 'pointer' }}
          >
            Esc
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="sk-body" style={{ fontSize: 13 }}>{s.desc}</span>
              <span className="sk-chip solid" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                {s.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { state, projects, lastRefreshed } = useLedgerData(selectedProject, refreshKey)

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('tally-theme') as 'light' | 'dark') ?? 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tally-theme', theme)
  }, [theme])

  // Shortcut help modal
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Keyboard shortcuts
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const tag = (e.target as HTMLElement).tagName
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

    if (e.key === '?' && !isInput) {
      e.preventDefault()
      setShowShortcuts((prev) => !prev)
      return
    }

    if (e.key === 'Escape') {
      setShowShortcuts(false)
      return
    }

    if (showShortcuts) return // when shortcut panel is open, only Esc works

    if (e.key === '/' && !isInput) {
      e.preventDefault()
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="搜索任务..."]')
      searchInput?.focus()
      return
    }

    if (e.key === 'r' && !isInput) {
      e.preventDefault()
      setRefreshKey((k) => k + 1)
      return
    }

    const numKey = parseInt(e.key)
    if (numKey >= 1 && numKey <= 6 && !isInput) {
      const el = sectionRefs.current[numKey]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [showShortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
    >
      {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )

  // Refresh indicator
  const refreshIndicator = lastRefreshed ? (
    <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
      更新于 {formatTime(lastRefreshed)}
    </span>
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
              {projects.length > 0 ? (
                <select
                  className="sk-select"
                  value={selectedProject ?? ''}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span className="sk-chip shrink-0">Tally</span>
              )}
              {themeToggle}
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
    <>
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}

      <DashboardLayout
        header={
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
            <div className="flex items-baseline gap-4 min-w-0 flex-wrap">
              <h1 className="sk-h1 shrink-0" style={{ fontSize: 44 }}>Tally 仪表盘</h1>
              {projects.length > 0 ? (
                <select
                  className="sk-select"
                  value={selectedProject ?? ''}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span className="sk-chip shrink-0">{state.status === 'ready' ? state.data.projectName : 'Tally'}</span>
              )}
              {refreshIndicator}
            </div>
            <div className="flex gap-2 shrink-0 items-center flex-wrap">
              {themeToggle}
              <span className="sk-chip">单人监控</span>
              <span className="sk-chip solid">● 实时</span>
            </div>
          </div>
        }
        overview={
          <section ref={(el) => { sectionRefs.current[1] = el }}>
            <ErrorBoundary fallbackName="概览">
              <OverviewBar data={merged} tasks={allTasks} modules={modules} />
            </ErrorBoundary>
          </section>
        }
        progressTrend={
          <section ref={(el) => { sectionRefs.current[2] = el }}>
            <ErrorBoundary fallbackName="进度趋势">
              <ProgressTrend osHistory={os.progressHistory} appHistory={state.data.app.progressHistory} />
            </ErrorBoundary>
          </section>
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
          <section ref={(el) => { sectionRefs.current[3] = el }}>
            <ErrorBoundary fallbackName="阶段矩阵">
              <StageMatrix stages={merged.allStages} />
            </ErrorBoundary>
          </section>
        }
        moduleDistribution={
          <section ref={(el) => { sectionRefs.current[4] = el }}>
            <ErrorBoundary fallbackName="模块分布">
              <LazyModuleDistribution tasks={allTasks} />
            </ErrorBoundary>
          </section>
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
          <section ref={(el) => { sectionRefs.current[5] = el }}>
            <ErrorBoundary fallbackName="代理贡献">
              <LazyAgentContribution rounds={rounds} tasks={allTasks} />
            </ErrorBoundary>
          </section>
        }
        dependencyGraph={
          <section ref={(el) => { sectionRefs.current[6] = el }}>
            <ErrorBoundary fallbackName="依赖图">
              <DependencyGraph tasks={allTasks} />
            </ErrorBoundary>
          </section>
        }
        taskTable={
          <ErrorBoundary fallbackName="任务列表">
            <TaskTable tasks={allTasks} allTasks={allTasks} />
          </ErrorBoundary>
        }
      />
    </>
  )
}
