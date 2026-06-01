// src/hooks/useKeyboardNav.ts
import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'

export interface NavCategory {
  id: string
  label: string
  sections: string[]
}

interface UseKeyboardNavOptions {
  categories: NavCategory[]
}

export interface NavState {
  activeCategory: number
  activeSection: number
  focusedItemIndex: number
  focusLevel: 0 | 1 | 2
  items: string[]
  sectionId: string
  registerItems: (sectionId: string, itemIds: string[]) => void
  focusSection: (catIdx: number, secIdx: number, restoreSaved?: boolean) => void
  /** Incremented each time a no-op Enter or Esc is pressed, so the UI can flash feedback */
  feedbackTrigger: number
  /** Cross-panel task navigation: jump to task in task table */
  navigateToTask?: (taskId: string) => void
  setNavigateToTask?: (fn: (taskId: string) => void) => void
}

export const NavContext = createContext<NavState | null>(null)
export function useNav() { return useContext(NavContext) }

export function useKeyboardNav({ categories }: UseKeyboardNavOptions): NavState {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const [focusLevel, setFocusLevel] = useState<0 | 1 | 2>(0)
  const [focusedItemIndex, setFocusedItemIndex] = useState(0)
  const [navigateToTask, setNavigateToTask] = useState<((taskId: string) => void) | undefined>(undefined)
  const [feedbackTrigger, setFeedbackTrigger] = useState(0)

  const itemRegistry = useRef<Map<string, string[]>>(new Map())

  const registerItems = useCallback((sectionId: string, itemIds: string[]) => {
    itemRegistry.current.set(sectionId, itemIds)
  }, [])

  const totalCategories = categories.length
  const cat = categories[activeCategory]
  const currentSections = cat?.sections.length ?? 0
  const sectionId = cat?.sections[activeSection] ?? ''
  const items = itemRegistry.current.get(sectionId) ?? []
  const currentItems = items.length

  // Per-category section position memory
  const sectionMemory = useRef<Map<number, number>>(new Map())

  const goNextCategory = useCallback(() => {
    sectionMemory.current.set(activeCategory, activeSection)
    setActiveCategory((prev) => {
      const next = (prev + 1) % totalCategories
      const saved = sectionMemory.current.get(next) ?? 0
      setActiveSection(saved)
      return next
    })
    setFocusLevel(1); setFocusedItemIndex(0)
  }, [activeCategory, activeSection, totalCategories])

  const goPrevCategory = useCallback(() => {
    sectionMemory.current.set(activeCategory, activeSection)
    setActiveCategory((prev) => {
      const next = (prev - 1 + totalCategories) % totalCategories
      const saved = sectionMemory.current.get(next) ?? 0
      setActiveSection(saved)
      return next
    })
    setFocusLevel(1); setFocusedItemIndex(0)
  }, [activeCategory, activeSection, totalCategories])

  const goNextSection = useCallback(() => {
    setActiveSection((prev) => Math.min(prev + 1, currentSections - 1))
    setFocusedItemIndex(0); setFocusLevel(1)
  }, [currentSections])

  const goPrevSection = useCallback(() => {
    setActiveSection((prev) => Math.max(prev - 1, 0))
    setFocusedItemIndex(0); setFocusLevel(1)
  }, [])

  const goNextItem = useCallback(() => {
    setFocusedItemIndex((prev) => Math.min(prev + 1, currentItems - 1))
  }, [currentItems])

  const goPrevItem = useCallback(() => {
    setFocusedItemIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const drillDown = useCallback(() => {
    if (focusLevel === 0) setFocusLevel(1)
    else if (focusLevel === 1 && currentItems > 0) { setFocusLevel(2); setFocusedItemIndex(0) }
    else setFeedbackTrigger((v) => v + 1)
  }, [focusLevel, currentItems])

  const goBack = useCallback(() => {
    if (focusLevel === 2) setFocusLevel(1)
    else if (focusLevel === 1) setFocusLevel(0)
    else setFeedbackTrigger((v) => v + 1)
  }, [focusLevel])

  const focusSection = useCallback((catIdx: number, secIdx: number, restoreSaved = false) => {
    sectionMemory.current.set(activeCategory, activeSection)
    const saved = restoreSaved ? sectionMemory.current.get(catIdx) : undefined
    setActiveCategory(catIdx); setActiveSection(saved ?? secIdx)
    setFocusLevel(1); setFocusedItemIndex(0)
  }, [activeCategory, activeSection])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); if (focusLevel <= 1) goNextCategory(); break
        case 'ArrowLeft': e.preventDefault(); if (focusLevel <= 1) goPrevCategory(); break
        case 'ArrowDown':
          e.preventDefault()
          if (focusLevel === 1) goNextSection()
          else if (focusLevel === 2) goNextItem()
          else setFeedbackTrigger((v) => v + 1) // flash hint bar: wrong key at L0
          break
        case 'ArrowUp':
          e.preventDefault()
          if (focusLevel === 1) goPrevSection()
          else if (focusLevel === 2) goPrevItem()
          else setFeedbackTrigger((v) => v + 1)
          break
        case 'Enter': e.preventDefault(); drillDown(); break
        case 'Escape': e.preventDefault(); goBack(); break
        case '/':
          if (focusLevel >= 1) {
            e.preventDefault()
            const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]')
            searchInput?.focus()
          }
          break
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          e.preventDefault()
          const idx = parseInt(e.key) - 1
          if (idx < totalCategories) { setActiveCategory(idx); setActiveSection(0); setFocusedItemIndex(0) }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusLevel, goNextCategory, goPrevCategory, goNextSection, goPrevSection, goNextItem, goPrevItem, drillDown, goBack, totalCategories])

  // Scroll focused item
  useEffect(() => {
    if (focusLevel !== 2) return
    const itemId = items[focusedItemIndex]
    if (!itemId) return
    const el = document.querySelector(`[data-nav-item="${itemId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusLevel, focusedItemIndex, items])

  // Scroll section
  useEffect(() => {
    if (focusLevel !== 1) return
    if (!sectionId) return
    const el = document.getElementById(`nav-${sectionId}`)
    if (!el) return
    const HEADER_H = 120
    const rect = el.getBoundingClientRect()
    if (rect.top < HEADER_H || rect.bottom > window.innerHeight) {
      window.scrollTo({ top: window.scrollY + rect.top - HEADER_H - 8, behavior: 'smooth' })
    }
  }, [activeCategory, activeSection, focusLevel, sectionId])

  return {
    activeCategory, activeSection, focusedItemIndex, focusLevel,
    items, sectionId, registerItems, focusSection,
    feedbackTrigger, navigateToTask, setNavigateToTask,
  }
}
