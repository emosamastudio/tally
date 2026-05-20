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
  focusSection: (catIdx: number, secIdx: number) => void
}

export const NavContext = createContext<NavState | null>(null)
export function useNav() { return useContext(NavContext) }

export function useKeyboardNav({ categories }: UseKeyboardNavOptions): NavState {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const [focusLevel, setFocusLevel] = useState<0 | 1 | 2>(1)
  const [focusedItemIndex, setFocusedItemIndex] = useState(0)

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

  const goNextCategory = useCallback(() => {
    setActiveCategory((prev) => (prev + 1) % totalCategories)
    setActiveSection(0); setFocusLevel(1); setFocusedItemIndex(0)
  }, [totalCategories])

  const goPrevCategory = useCallback(() => {
    setActiveCategory((prev) => (prev - 1 + totalCategories) % totalCategories)
    setActiveSection(0); setFocusLevel(1); setFocusedItemIndex(0)
  }, [totalCategories])

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
  }, [focusLevel, currentItems])

  const goBack = useCallback(() => {
    if (focusLevel === 2) setFocusLevel(1)
    else if (focusLevel === 1) setFocusLevel(0)
  }, [focusLevel])

  const focusSection = useCallback((catIdx: number, secIdx: number) => {
    setActiveCategory(catIdx); setActiveSection(secIdx)
    setFocusLevel(1); setFocusedItemIndex(0)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); if (focusLevel === 0) goNextCategory(); break
        case 'ArrowLeft': e.preventDefault(); if (focusLevel === 0) goPrevCategory(); break
        case 'ArrowDown':
          e.preventDefault()
          if (focusLevel === 1) goNextSection()
          else if (focusLevel === 2) goNextItem()
          break
        case 'ArrowUp':
          e.preventDefault()
          if (focusLevel === 1) goPrevSection()
          else if (focusLevel === 2) goPrevItem()
          break
        case 'Enter': e.preventDefault(); drillDown(); break
        case 'Escape': e.preventDefault(); goBack(); break
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          e.preventDefault()
          const idx = parseInt(e.key) - 1
          if (idx < totalCategories) { setActiveCategory(idx); setActiveSection(0); setFocusLevel(1); setFocusedItemIndex(0) }
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
    const el = document.getElementById(`focus-${itemId}`)
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
  }
}
