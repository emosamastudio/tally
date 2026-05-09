// src/hooks/useLedgerData.ts
import { useState, useEffect } from 'react'
import type { LoadState } from '@/lib/types'
import { loadLedgerData } from '@/lib/loader'

export function useLedgerData(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loadLedgerData()
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
  }, [])

  return state
}
