// src/hooks/useL2Navigation.ts
import { useContext, useEffect } from 'react'
import { NavContext } from '@/components/dashboard-layout'

/**
 * Hook for sections to register focusable items for L2 keyboard navigation.
 *
 * Usage:
 *   const { isL2, focusedIndex } = useL2Navigation('my-section', itemIds)
 *   // Add data-nav-item={itemIds[i]} to each focusable element
 *   // Use isL2 && focusedIndex === i for highlight styling
 */
export function useL2Navigation(sectionId: string, itemIds: string[]) {
  const nav = useContext(NavContext)

  useEffect(() => {
    if (nav && itemIds.length > 0) {
      nav.registerItems(sectionId, itemIds)
    }
  }, [nav, sectionId, ...itemIds])

  const isL2 = nav?.focusLevel === 2 && nav?.sectionId === sectionId
  const focusedIndex = nav?.focusedItemIndex ?? 0

  return { isL2: isL2 ?? false, focusedIndex, nav }
}

/** Inline style for a focused L2 item. */
export function l2FocusStyle(isFocused: boolean): React.CSSProperties {
  if (!isFocused) return {}
  return {
    outline: '2px solid var(--accent)',
    outlineOffset: 2,
    background: 'rgba(245,180,60,0.12)',
    borderRadius: 'var(--sk-radius)',
    transition: 'outline 0.15s, background 0.15s',
  }
}
