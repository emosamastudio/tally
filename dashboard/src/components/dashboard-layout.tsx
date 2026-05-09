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
  roundTimeline?: ReactNode
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
  roundTimeline,
}: DashboardLayoutProps) {
  return (
    <div className="sk-board">
      <div className="sk-grid" />
      <div className="relative mx-auto max-w-7xl px-4 py-4 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          {header}
        </header>

        {/* Overview bar — KPI strip */}
        {overview && <section>{overview}</section>}

        {/* Row 1: Progress trend + Current round */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{progressTrend}</div>
          <div className="lg:col-span-1">{currentRound}</div>
        </section>

        {/* Row 1b: Round analytics (burndown + velocity) */}
        {roundAnalytics && <section>{roundAnalytics}</section>}

        {/* Row 2: Stage matrix + small panels + Block list */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-2">{stageMatrix}</div>
          <div className="lg:col-span-1 space-y-4">
            {moduleDistribution}
            {priorityDonut}
          </div>
          <div className="lg:col-span-1">{blockList}</div>
        </section>

        {/* Row 3: Agent contribution */}
        {agentContribution && <section>{agentContribution}</section>}

        {/* Row 4: Round timeline */}
        {roundTimeline && <section>{roundTimeline}</section>}

        {/* Row 5: Dependency graph */}
        <section>{dependencyGraph}</section>

        {/* Row 6: Task table */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
