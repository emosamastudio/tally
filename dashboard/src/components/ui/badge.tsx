// src/components/ui/badge.tsx
// SketchChip — rounded pill with hand-drawn border
import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

const variants = {
  default: 'sk-chip',
  green: 'sk-chip ok',
  yellow: 'sk-chip',
  red: 'sk-chip danger',
  blue: 'sk-chip',
  purple: 'sk-chip',
  gray: 'sk-chip',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(variants[variant], className)}
      {...props}
    />
  )
}
