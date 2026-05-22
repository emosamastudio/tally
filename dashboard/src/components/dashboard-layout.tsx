// src/components/dashboard-layout.tsx
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useKeyboardNav, NavContext } from '@/hooks/useKeyboardNav'
import type { NavCategory } from '@/hooks/useKeyboardNav'

export type { NavCategory }
export { NavContext }

interface DashboardLayoutProps {
  header: ReactNode
  categories: NavCategory[]
  children: Record<string, ReactNode>
}

const SECTION_LABELS: Record<string, string> = {
  'overview-panel': '概览面板',
  'stage-matrix': '阶段矩阵',
  'feature-progress': '功能进度',
  'feature-deps': '功能依赖',
  'current-round': '当前回合',
  'agent-activity': '活跃Agent',
  'round-timeline': '回合时间线',
  'round-analytics': '回合分析',
  'task-table': '任务列表',
  'agent-contribution': 'Agent贡献',
  'dependency-graph': '依赖图',
}

const LEVEL_HINT: Record<number, string> = { 0: '←→ 选择分类 · Enter 进入', 1: '←→ 分类 · ↑↓ 板块 · Enter 进入 · Esc 返回', 2: '↑↓ 项目 · Esc 返回' }

export default function DashboardLayout({ header, categories, children }: DashboardLayoutProps) {
  const nav = useKeyboardNav({ categories })
  const cat = categories[nav.activeCategory]
  const sectionId = cat?.sections[nav.activeSection]
  const hintRef = useRef<HTMLDivElement>(null)
  const currentSections = cat?.sections.length ?? 0
  const hintText = useMemo(() => {
    if (nav.focusLevel === 1 && currentSections === 1) return '←→ 分类 · 仅 1 个板块 · Enter 进入'
    return LEVEL_HINT[nav.focusLevel]
  }, [nav.focusLevel, currentSections])

  // Flash the hint bar when Enter/Esc are no-ops (e.g. Enter at L1 with no L2 items, Esc at L0)
  useEffect(() => {
    if (nav.feedbackTrigger === 0) return
    const el = hintRef.current
    if (!el) return
    el.classList.add('sk-flash')
    const timer = setTimeout(() => el.classList.remove('sk-flash'), 500)
    return () => { clearTimeout(timer); el.classList.remove('sk-flash') }
  }, [nav.feedbackTrigger])

  return (
    <NavContext.Provider value={nav}>
      <div className="sk-board" style={{ overflow: 'clip', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <a
          href="#main-content"
          className="sr-only"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
          onFocus={(e) => {
            const el = e.currentTarget
            el.style.width = 'auto'
            el.style.height = 'auto'
            el.style.padding = '8px 16px'
            el.style.margin = '0'
            el.style.clip = 'auto'
            el.style.clipPath = 'none'
            el.style.whiteSpace = 'normal'
            el.style.position = 'absolute'
            el.style.top = '4px'
            el.style.left = '4px'
            el.style.zIndex = '50'
            el.style.background = 'var(--paper)'
            el.style.border = '2px solid var(--ink)'
            el.style.borderRadius = 'var(--sk-radius)'
          }}
          onBlur={(e) => {
            const el = e.currentTarget
            el.style.width = '1px'
            el.style.height = '1px'
            el.style.padding = '0'
            el.style.margin = '-1px'
            el.style.clip = 'rect(0,0,0,0)'
            el.style.clipPath = ''
            el.style.whiteSpace = 'nowrap'
            el.style.position = 'absolute'
            el.style.top = ''
            el.style.left = ''
            el.style.zIndex = ''
          }}
        >
          跳到内容
        </a>
        <div className="sk-grid" />

        {/* Sticky header */}
        <div style={{ flexShrink: 0, zIndex: 20, background: 'var(--paper)', borderBottom: '1px solid var(--ink-4)', paddingBottom: 8 }}>
          <div className="mx-auto max-w-7xl px-2 md:px-4 pt-4">
            <header className="flex items-center justify-between">
              {header}
            </header>

            {/* L1 Category Tabs */}
            <nav className="flex gap-1 overflow-x-auto pb-1 mt-2" style={{ scrollbarWidth: 'thin' }} role="tablist" aria-label="分类导航">
              {categories.map((cat, ci) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={nav.activeCategory === ci}
                  aria-controls={`panel-${cat.id}`}
                  className="sk-chip shrink-0"
                  style={{
                    fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                    background: nav.activeCategory === ci ? 'var(--accent)' : 'var(--paper-2)',
                    color: nav.activeCategory === ci ? 'var(--paper)' : 'var(--ink-2)',
                    borderColor: nav.activeCategory === ci ? 'var(--accent)' : 'var(--ink-4)',
                    fontWeight: nav.activeCategory === ci ? 600 : 400,
                    outline: nav.focusLevel === 0 && nav.activeCategory === ci ? '2px solid var(--ink)' : 'none',
                    outlineOffset: nav.focusLevel === 0 && nav.activeCategory === ci ? 2 : 0,
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
            <div ref={hintRef} className="flex items-center justify-between" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              <span>{hintText}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--ink-2)' }}>{cat?.label} › {SECTION_LABELS[sectionId] ?? sectionId}</span>
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
        <div id="main-content" role="main" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {categories.map((cat, ci) => (
            <div
              key={cat.id}
              style={{ display: nav.activeCategory === ci ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
              role="tabpanel"
              id={`panel-${cat.id}`}
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
                        borderLeft: isActive ? (nav.focusLevel === 0 ? '3px dashed var(--accent)' : '3px solid var(--accent)') : '3px solid transparent',
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
