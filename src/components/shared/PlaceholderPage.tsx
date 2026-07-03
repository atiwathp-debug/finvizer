import { isMockMode, MOCK_MODE_BANNER_TEXT } from '@/lib/mock'

interface PlaceholderPageProps {
  title: string
  description: string
}

/**
 * Stand-in for routes not yet implemented. Each Sub Phase replaces the
 * matching route element with its real feature UI (see src/routes/index.tsx).
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-surface px-6 py-12 text-center">
      {isMockMode && (
        <div className="rounded-full border border-warning-500/30 bg-warning-500/10 px-4 py-1.5 text-sm font-medium text-warning-500">
          {MOCK_MODE_BANNER_TEXT}
        </div>
      )}
      <div className="rounded-2xl border border-line bg-surface-raised px-8 py-10 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      </div>
    </div>
  )
}
