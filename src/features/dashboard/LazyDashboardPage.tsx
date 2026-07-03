import { lazy, Suspense } from 'react'
import { StatCardSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton'

// Recharts is heavy — code-split it off the main bundle since only the
// dashboard needs it.
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <TableSkeleton rows={5} />
    </div>
  )
}

export function LazyDashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardPage />
    </Suspense>
  )
}
