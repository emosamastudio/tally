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
      <div className="relative mx-auto max-w-7xl px-2 md:px-4 py-4 space-y-4 md:space-y-6">
        {/* ROW 0: Header */}
        <header className="flex items-center justify-between">
          {header}
        </header>

        {/* ROW 1: KPI Strip — full width */}
        {overview && <section>{overview}</section>}

        {/* ROW 2: Two columns — ProgressTrend + RoundAnalytics (left 2/3) | CurrentRound (right 1/3) */}
        <section className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {progressTrend}
            {roundAnalytics}
          </div>
          <div className="md:col-span-1">{currentRound}</div>
        </section>

        {/* ROW 3a: Stage Matrix — full width horizontal pipeline */}
        <section>{stageMatrix}</section>

        {/* ROW 3b: Three equal columns — Priority Donut | Module Distribution | Block List */}
        <section className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
          <div className="flex">{priorityDonut}</div>
          <div className="flex">{moduleDistribution}</div>
          <div className="flex">{blockList}</div>
        </section>

        {/* ROW 4: Full width — AgentContribution */}
        {agentContribution && <section>{agentContribution}</section>}

        {/* ROW 5: Full width — DependencyGraph (tall) */}
        <section className="min-h-[400px] md:min-h-[500px]">{dependencyGraph}</section>

        {/* ROW 6: Full width — TaskTable */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
