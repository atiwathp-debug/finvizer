import { Info } from 'lucide-react'

export function PhaseNotice({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
