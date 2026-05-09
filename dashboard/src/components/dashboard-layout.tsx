// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  header: ReactNode
  overview: ReactNode
  progressTrend: ReactNode
  currentRound: ReactNode
  roundAnalytics?: ReactNode
  stageMatrix: ReactNode
  moduleDistribution?: ReactNode
  priorityDonut?: ReactNode
  blockList: ReactNode
  agentContribution?: ReactNode
  dependencyGraph: ReactNode
  taskTable: ReactNode
}

export default function DashboardLayout({
  header,
  overview,
  progressTrend,
  currentRound,
  roundAnalytics,
  stageMatrix,
  moduleDistribution,
  priorityDonut,
  blockList,
  agentContribution,
  dependencyGraph,
  taskTable,
}: DashboardLayoutProps) {
  return (
    <div className="sk-board">
      <div className="sk-grid" />
      <div className="relative mx-auto max-w-7xl px-4 py-4 space-y-4">
        {/* ROW 0: Header */}
        <header className="flex items-center justify-between">
          {header}
        </header>

        {/* ROW 1: KPI Strip — full width */}
        {overview && <section>{overview}</section>}

        {/* ROW 2: Two columns — ProgressTrend + RoundAnalytics (left 2/3) | CurrentRound (right 1/3) */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {progressTrend}
            {roundAnalytics}
          </div>
          <div className="md:col-span-1">{currentRound}</div>
        </section>

        {/* ROW 3: Three columns — StageMatrix (1/2) | PriorityDonut + ModuleDistribution (1/4) | BlockList (1/4) */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="md:col-span-2">{stageMatrix}</div>
          <div className="md:col-span-1 space-y-4">
            {priorityDonut}
            {moduleDistribution}
          </div>
          <div className="md:col-span-1">{blockList}</div>
        </section>

        {/* ROW 4: Full width — AgentContribution */}
        {agentContribution && <section>{agentContribution}</section>}

        {/* ROW 5: Full width — DependencyGraph (tall) */}
        <section style={{ minHeight: 500 }}>{dependencyGraph}</section>

        {/* ROW 6: Full width — TaskTable */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
