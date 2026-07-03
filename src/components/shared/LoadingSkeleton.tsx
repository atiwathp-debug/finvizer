import { Skeleton } from '@/components/ui/Skeleton'

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-4 h-3 w-20" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line bg-surface/60 p-4">
        <Skeleton className="h-4 w-full max-w-xs" />
      </div>
      <ul className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => i).map((i) => (
          <li key={`skeleton-row-${i}`} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-4 w-16" />
          </li>
        ))}
      </ul>
    </div>
  )
}
