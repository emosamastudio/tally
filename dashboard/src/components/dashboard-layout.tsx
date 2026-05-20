// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'
import { useKeyboardNav, NavContext } from '@/hooks/useKeyboardNav'
import type { NavCategory } from '@/hooks/useKeyboardNav'

export type { NavCategory }
export { NavContext }

interface DashboardLayoutProps {
  header: ReactNode
  categories: NavCategory[]
  children: Record<string, ReactNode>
}

const LEVEL_HINT: Record<number, string> = { 0: '←→ 选择分类', 1: '↑↓ 选择板块 · Enter 进入', 2: '↑↓ 选择项目 · Esc 返回 · Enter 确认' }

export default function DashboardLayout({ header, categories, children }: DashboardLayoutProps) {
  const nav = useKeyboardNav({ categories })
  const cat = categories[nav.activeCategory]
  const sectionId = cat?.sections[nav.activeSection]

  return (
    <NavContext.Provider value={nav}>
      <div className="sk-board" style={{ overflow: 'clip', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sk-grid" />

        {/* Sticky header */}
        <div style={{ flexShrink: 0, zIndex: 20, background: 'var(--paper)', borderBottom: '1px solid var(--ink-4)', paddingBottom: 8 }}>
          <div className="mx-auto max-w-7xl px-2 md:px-4 pt-4">
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
                    fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                    background: nav.activeCategory === ci ? 'var(--accent)' : 'var(--paper-2)',
                    color: nav.activeCategory === ci ? 'var(--paper)' : 'var(--ink-2)',
                    borderColor: nav.activeCategory === ci ? 'var(--accent)' : 'var(--ink-4)',
                    fontWeight: nav.activeCategory === ci ? 600 : 400,
                    outline: nav.focusLevel === 0 && nav.activeCategory === ci ? '2px solid var(--accent)' : 'none',
                  }}
                  onClick={() => nav.focusSection(ci, 0)}
                >
                  <span className="sk-mono" style={{ fontSize: 10, color: nav.activeCategory === ci ? 'var(--paper)' : 'var(--ink-4)', marginRight: 4 }}>{ci + 1}</span>
                  {cat.label}
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>{cat.sections.length}</span>
                </button>
              ))}
            </nav>

            {/* Hint bar */}
            <div className="flex items-center justify-between" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
              <span>{LEVEL_HINT[nav.focusLevel]}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--ink-2)' }}>{cat?.label} › {sectionId}</span>
                <span style={{ display: 'flex', gap: 3 }}>
                  {cat?.sections.map((_, si) => (
                    <span key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: si === nav.activeSection ? 'var(--accent)' : 'var(--ink-4)', transition: 'background 0.2s' }} />
                  ))}
                </span>
                <span className="sk-mono" style={{ fontSize: 9 }}>{nav.activeSection + 1}/{cat?.sections.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {categories.map((cat, ci) => (
            <div
              key={cat.id}
              style={{ display: nav.activeCategory === ci ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
              role="tabpanel"
            >
              <div className="mx-auto max-w-7xl px-2 md:px-4 py-4" style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {cat.sections.map((sectionId, si) => {
                  const content = children[sectionId]
                  if (!content) return null
                  const isActive = si === nav.activeSection
                  const isL2 = isActive && nav.focusLevel === 2
                  return (
                    <section
                      key={sectionId}
                      id={`nav-${sectionId}`}
                      style={{
                        display: isActive ? 'flex' : 'none',
                        flexDirection: 'column',
                        flex: 1,
                        overflow: 'auto',
                        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                        background: isL2 ? 'rgba(245,180,60,0.04)' : 'transparent',
                        borderRadius: '0 var(--sk-radius) var(--sk-radius) 0',
                        paddingLeft: isActive ? 12 : 0,
                        transition: 'border-color 0.2s, background 0.2s',
                        minHeight: 0,
                      }}
                    >
                      {content}
                    </section>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </NavContext.Provider>
  )
}
