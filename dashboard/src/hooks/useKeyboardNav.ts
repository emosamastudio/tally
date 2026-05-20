// src/hooks/useKeyboardNav.ts
import { useEffect, useState, useCallback } from 'react'

export interface NavCategory {
  id: string
  label: string
  sections: string[]
}

interface UseKeyboardNavOptions {
  categories: NavCategory[]
}

/** Estimated height of the sticky header (title + tabs + hint) */
const HEADER_HEIGHT = 110

export function useKeyboardNav({ categories }: UseKeyboardNavOptions) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [activeSection, setActiveSection] = useState(0)

  const totalCategories = categories.length
  const currentSections = categories[activeCategory]?.sections.length ?? 0

  useEffect(() => {
    if (activeSection >= currentSections) {
      setActiveSection(Math.max(0, currentSections - 1))
    }
  }, [activeCategory, currentSections, activeSection])

  const goNextCategory = useCallback(() => {
    setActiveCategory((prev) => (prev + 1) % totalCategories)
  }, [totalCategories])

  const goPrevCategory = useCallback(() => {
    setActiveCategory((prev) => (prev - 1 + totalCategories) % totalCategories)
  }, [totalCategories])

  const goNextSection = useCallback(() => {
    setActiveSection((prev) => Math.min(prev + 1, currentSections - 1))
  }, [currentSections])

  const goPrevSection = useCallback(() => {
    setActiveSection((prev) => Math.max(prev - 1, 0))
  }, [])

  const focusSection = useCallback((catIdx: number, secIdx: number) => {
    setActiveCategory(catIdx)
    setActiveSection(secIdx)
  }, [])

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          goNextCategory()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrevCategory()
          break
        case 'ArrowDown':
          e.preventDefault()
          goNextSection()
          break
        case 'ArrowUp':
          e.preventDefault()
          goPrevSection()
          break
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          e.preventDefault()
          const idx = parseInt(e.key) - 1
          if (idx < totalCategories) {
            setActiveCategory(idx)
            setActiveSection(0)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNextCategory, goPrevCategory, goNextSection, goPrevSection, totalCategories])

  // Scroll active section to top of viewport (below sticky header)
  useEffect(() => {
    const cat = categories[activeCategory]
    if (!cat) return
    const sectionId = cat.sections[activeSection]
    if (!sectionId) return
    const el = document.getElementById(`nav-${sectionId}`)
    if (!el) return

    const rect = el.getBoundingClientRect()
    const isVisible = rect.top >= HEADER_HEIGHT && rect.bottom <= window.innerHeight

    // Only scroll if the section isn't already fully visible
    if (!isVisible) {
      const targetY = window.scrollY + rect.top - HEADER_HEIGHT - 8
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }, [activeCategory, activeSection, categories])

  return {
    activeCategory,
    activeSection,
    goNextCategory,
    goPrevCategory,
    goNextSection,
    goPrevSection,
    focusSection,
    totalCategories,
  }
}
