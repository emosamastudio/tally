// src/components/ui/progress.tsx
// SketchProgress — thick border track with filled portion
import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  className?: string
  accent?: boolean
  danger?: boolean
}

export function Progress({ value, className, accent, danger }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('sk-progress-track', className)}>
      <div
        className={cn(
          'sk-progress-fill',
          accent && 'accent',
          danger && 'danger',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
