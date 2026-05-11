// src/components/charts-carousel.tsx
import { useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Tab {
  key: string
  label: string
  content: ReactNode
}

interface ChartsCarouselProps {
  tabs: Tab[]
}

export default function ChartsCarousel({ tabs }: ChartsCarouselProps) {
  const [active, setActive] = useState(0)
  const current = tabs[active]

  if (tabs.length === 0) return null

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      {/* Tab bar */}
      <div className="flex items-center border-b" style={{ borderColor: 'var(--ink)', borderWidth: '1.6px', padding: '0 4px' }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActive(i)}
            className="sk-body"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              border: 'none',
              background: i === active ? 'var(--paper-2)' : 'transparent',
              borderBottom: i === active ? '2px solid var(--ink)' : '2px solid transparent',
              cursor: 'pointer',
              color: i === active ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: i === active ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* Swipe hint */}
        <div className="ml-auto flex items-center gap-1 pr-2">
          <button
            onClick={() => setActive((a) => (a > 0 ? a - 1 : tabs.length - 1))}
            className="sk-chip" style={{ cursor: 'pointer', padding: '2px 6px' }}
          >
            <ChevronLeft size={12} />
          </button>
          <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {active + 1}/{tabs.length}
          </span>
          <button
            onClick={() => setActive((a) => (a < tabs.length - 1 ? a + 1 : 0))}
            className="sk-chip" style={{ cursor: 'pointer', padding: '2px 6px' }}
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-0" style={{ flex: 1 }}>
        {current.content}
      </CardContent>
    </Card>
  )
}

export function ChartsCarouselSkeleton() {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <div className="flex items-center border-b" style={{ borderColor: 'var(--ink)', borderWidth: '1.6px', padding: '4px 8px' }}>
        {['进度趋势', '回合分析', 'Agent 贡献'].map((label, i) => (
          <span
            key={label}
            className="sk-body"
            style={{
              padding: '8px 16px', fontSize: 13,
              color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: i === 0 ? 700 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <CardContent className="p-0" style={{ flex: 1 }}>
        <div style={{ height: 280, background: 'var(--paper-2)', borderRadius: 'var(--sk-radius)', margin: 12 }} />
      </CardContent>
    </Card>
  )
}
