// src/hooks/useLedgerData.ts
import { useState, useEffect, useRef } from 'react'
import type { LoadState, ProjectInfo } from '@/lib/types'
import { loadLedgerData, loadProjects, adaptTallyDocument } from '@/lib/loader'

const POLL_INTERVAL_MS = 30_000

export function useLedgerData(projectName: string | null, refreshKey?: number) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const lastUpdatedRef = useRef<string | null>(null)

  // Load project list once on mount
  useEffect(() => {
    loadProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  // Load ledger data when project changes
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loadLedgerData(projectName ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data })
          setLastRefreshed(new Date())
          lastUpdatedRef.current = data.updated
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : '加载台账数据时发生未知错误',
          })
        }
      })
    return () => { cancelled = true }
  }, [projectName, refreshKey])

  // Polling for real-time refresh (only when data is ready)
  useEffect(() => {
    if (state.status !== 'ready') return

    const buildUrl = projectName
      ? `/api/ledger?project=${encodeURIComponent(projectName)}`
      : '/api/ledger'

    const interval = setInterval(async () => {
      try {
        const res = await fetch(buildUrl)
        if (!res.ok) return // silently ignore errors
        const raw = await res.json()
        const newUpdated = raw._meta?.updated ?? null
        if (newUpdated && newUpdated !== lastUpdatedRef.current) {
          // Data changed — reload
          const data = adaptTallyDocument(raw)
          setState({ status: 'ready', data })
          setLastRefreshed(new Date())
          lastUpdatedRef.current = newUpdated
        } else {
          // No data change, just update the timestamp to show poll is alive
          setLastRefreshed(new Date())
        }
      } catch {
        // Silently ignore polling errors — don't replace valid data
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [state.status, projectName])

  return { state, projects, lastRefreshed }
}
