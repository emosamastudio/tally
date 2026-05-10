import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallbackName?: string }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="sk-box dashed" style={{
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderColor: 'var(--danger)',
        }}>
          <span className="sk-h3" style={{ color: 'var(--danger)' }}>
            {this.props.fallbackName ?? '图表'} 加载失败
          </span>
          <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {this.state.error?.message ?? '未知错误'}
          </span>
        </div>
      )
    }
    return this.props.children
  }
}
