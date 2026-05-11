// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  header: ReactNode
  overview: ReactNode
  blockList: ReactNode
  chartsCarousel?: ReactNode
  currentRound: ReactNode
  stageMatrix: ReactNode
  distributionPanel?: ReactNode
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
  distributionPanel,
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

        {/* ROW 4: Stage Matrix — full width horizontal pipeline */}
        <section>{stageMatrix}</section>

        {/* ROW 5: Distribution Panel — Priority + Module in a single card */}
        {distributionPanel && <section>{distributionPanel}</section>}

        {/* ROW 6: DependencyGraph (tall) */}
        <section className="min-h-[400px] md:min-h-[500px]">{dependencyGraph}</section>

        {/* ROW 7: TaskTable */}
        <section>{taskTable}</section>
      </div>
    </div>
  )
}
