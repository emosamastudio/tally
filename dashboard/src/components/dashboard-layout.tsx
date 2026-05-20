// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import type { NavCategory } from '@/hooks/useKeyboardNav'

export type { NavCategory }

interface DashboardLayoutProps {
  header: ReactNode
  categories: NavCategory[]
  children: Record<string, ReactNode>
}

export default function DashboardLayout({ header, categories, children }: DashboardLayoutProps) {
  const nav = useKeyboardNav({ categories })

  return (
    <div className="sk-board" style={{ overflow: 'clip' }}>
      <div className="sk-grid" />

      {/* Sticky header: title + category tabs — always visible */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--paper)',
          borderBottom: '1px solid var(--ink-4)',
          paddingBottom: 8,
          marginBottom: 8,
        }}
      >
        <div className="relative mx-auto max-w-7xl px-2 md:px-4 pt-4">
          {/* ROW 0: Header */}
          <header className="flex items-center justify-between">
            {header}
          </header>

          {/* L1 Category Tabs */}
          <nav className="flex gap-1 overflow-x-auto pb-1 mt-2" style={{ scrollbarWidth: 'thin' }} role="tablist">
            {categories.map((cat, ci) => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={nav.activeCategory === ci}
                className="sk-chip shrink-0"
                style={{
                  fontSize: 12,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  background: nav.activeCategory === ci ? 'var(--accent)' : 'var(--paper-2)',
                  color: nav.activeCategory === ci ? 'var(--paper)' : 'var(--ink-2)',
                  borderColor: nav.activeCategory === ci ? 'var(--accent)' : 'var(--ink-4)',
                  fontWeight: nav.activeCategory === ci ? 600 : 400,
                }}
                onClick={() => nav.focusSection(ci, 0)}
              >
                <span className="sk-mono" style={{ fontSize: 10, color: nav.activeCategory === ci ? 'var(--paper)' : 'var(--ink-4)', marginRight: 4 }}>
                  {ci + 1}
                </span>
                {cat.label}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                  {cat.sections.length}
                </span>
              </button>
            ))}
          </nav>

          {/* Category hint + breadcrumb */}
          <div className="sk-body" style={{ fontSize: 10, color: 'var(--ink-4)', display: 'flex', gap: 12, marginTop: 2 }}>
            <span>←→ 分类</span>
            <span>↑↓ 选择</span>
            <span>1-{categories.length} 跳转</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-2)' }}>
              {categories[nav.activeCategory]?.label} › {categories[nav.activeCategory]?.sections[nav.activeSection]}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative mx-auto max-w-7xl px-2 md:px-4 py-4 space-y-4 md:space-y-6">
        {categories.map((cat, ci) => (
          <div
            key={cat.id}
            style={{ display: nav.activeCategory === ci ? 'block' : 'none' }}
            role="tabpanel"
            aria-hidden={nav.activeCategory !== ci}
          >
            <div className="space-y-4 md:space-y-6">
              {cat.sections.map((sectionId, si) => {
                const content = children[sectionId]
                if (!content) return null
                const isFocused = nav.activeCategory === ci && nav.activeSection === si
                return (
                  <section
                    key={sectionId}
                    id={`nav-${sectionId}`}
                    style={{
                      borderLeft: isFocused ? '3px solid var(--accent)' : '3px solid transparent',
                      background: isFocused ? 'rgba(245,180,60,0.06)' : 'transparent',
                      borderRadius: '0 var(--sk-radius) var(--sk-radius) 0',
                      paddingLeft: isFocused ? 12 : 0,
                      transition: 'border-color 0.2s, background 0.2s, padding 0.2s',
                      position: 'relative',
                    }}
                  >
                    {isFocused && (
                      <div style={{
                        position: 'absolute', left: -16, top: 8,
                        width: 24, height: 20,
                        background: 'var(--accent)',
                        borderRadius: '0 3px 3px 0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 9, color: 'var(--paper)', fontWeight: 700 }}>
                          {si + 1}
                        </span>
                      </div>
                    )}
                    {content}
                  </section>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
