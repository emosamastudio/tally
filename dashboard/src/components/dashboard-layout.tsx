// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  header: ReactNode
  overview: ReactNode
  blockList: ReactNode
  chartsCarousel?: ReactNode
  currentRound: ReactNode
  stageMatrix: ReactNode
  featureProgress?: ReactNode
  agentActivity?: ReactNode
  roundTimeline?: ReactNode
  featureDeps?: ReactNode
  dependencyGraph: ReactNode
  taskTable: ReactNode
}

export default function DashboardLayout({
  header,
  overview,
  blockList,
  chartsCarousel,
  currentRound,
  stageMatrix,
  featureProgress,
  agentActivity,
  roundTimeline,
  featureDeps,
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

        {/* ROW 2: Block List — most important, full width */}
        <section>{blockList}</section>

        {/* ROW 3: Charts Carousel (left 2/3) | Current Round (right 1/3) */}
        <section className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            {chartsCarousel}
          </div>
          <div className="md:col-span-1">{currentRound}</div>
        </section>

        {/* ROW 4: Stage Matrix — full width horizontal pipeline (with module breakdown) */}
        <section>{stageMatrix}</section>

        {/* ROW 4.5: Feature Progress */}
        {featureProgress && <section>{featureProgress}</section>}

        {/* ROW 4.6: Agent Activity */}
        {agentActivity && <section>{agentActivity}</section>}

        {/* ROW 4.7: Round Timeline */}
        {roundTimeline && <section>{roundTimeline}</section>}

        {/* ROW 4.8: Feature Dependencies */}
        {featureDeps && <section>{featureDeps}</section>}

        {/* ROW 5: DependencyGraph (tall) */}
        <section className="min-h-[400px] md:min-h-[500px]">{dependencyGraph}</section>

        {/* ROW 6: TaskTable */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
