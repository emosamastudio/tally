// src/hooks/useLedgerData.ts
import { useState, useEffect } from 'react'
import type { LoadState, ProjectInfo } from '@/lib/types'
import { loadLedgerData, loadProjects } from '@/lib/loader'

export function useLedgerData(projectName: string | null) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [projects, setProjects] = useState<ProjectInfo[]>([])

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
        if (!cancelled) setState({ status: 'ready', data })
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
  }, [projectName])

  return { state, projects }
}
