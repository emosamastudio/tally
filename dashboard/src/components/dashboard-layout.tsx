// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  header: ReactNode
  overview: ReactNode
  progressTrend: ReactNode
  currentRound: ReactNode
  stageMatrix: ReactNode
  blockList: ReactNode
  dependencyGraph: ReactNode
  taskTable: ReactNode
  roundTimeline?: ReactNode
}

export default function DashboardLayout({
  header,
  overview,
  progressTrend,
  currentRound,
  stageMatrix,
  blockList,
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

        {/* Row 2: Stage matrix + Block list */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {stageMatrix}
          {blockList}
        </section>

        {/* Row 3: Round timeline (NEW) */}
        {roundTimeline && <section>{roundTimeline}</section>}

        {/* Row 4: Dependency graph */}
        <section>{dependencyGraph}</section>

        {/* Row 5: Task table */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
