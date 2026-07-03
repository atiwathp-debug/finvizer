import { Loader2 } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  )
}
