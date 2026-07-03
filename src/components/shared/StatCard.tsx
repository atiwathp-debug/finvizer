import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  trend?: { direction: 'up' | 'down'; label: string }
  tone?: 'brand' | 'accent'
}

const toneClasses = {
  brand: 'bg-brand-50 text-brand-600',
  accent: 'bg-accent-50 text-accent-600',
} as const

export function StatCard({ label, value, icon: Icon, trend, tone = 'brand' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        </div>
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', toneClasses[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      {trend && (
        <div
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-xs font-medium',
            trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600',
          )}
        >
          {trend.direction === 'up' ? (
            <TrendingUp className="size-3.5" aria-hidden="true" />
          ) : (
            <TrendingDown className="size-3.5" aria-hidden="true" />
          )}
          {trend.label}
        </div>
      )}
    </div>
  )
}
