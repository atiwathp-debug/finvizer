import { Building2 } from 'lucide-react'
import { useCompanyStore } from '@/stores/companyStore'

export function CurrentCompanyBadge() {
  const company = useCompanyStore((state) => state.company)

  // Defensive only — AppShell is wrapped in RequireCompany, so this should
  // always have a company by the time it renders.
  if (!company) return null

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Building2 className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{company.nameTh}</p>
        <p className="truncate text-xs text-ink-muted">
          {company.companyCode} · {company.branchName}
        </p>
      </div>
    </div>
  )
}
