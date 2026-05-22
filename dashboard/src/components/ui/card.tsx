// src/components/ui/card.tsx
// SketchBox — the fundamental container primitive
import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  dashed?: boolean
  fill?: boolean
  thin?: boolean
  hatch?: boolean
  tilt?: 1 | 2 | 3
}

export function Card({ className, dashed, fill, thin, hatch, tilt, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'sk-box',
        dashed && 'dashed',
        fill && 'fill',
        thin && 'thin',
        hatch && 'hatch',
        tilt && `sk-tilt-${tilt}`,
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('pb-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('sk-h3', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />
}
