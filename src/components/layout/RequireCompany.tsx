import { Navigate, Outlet } from 'react-router-dom'
import { useCompanyStore } from '@/stores/companyStore'

/**
 * Sends users with no company yet to onboarding, and users whose company
 * hasn't picked a document template yet to /onboarding/template (Phase
 * 2A) — the main document workflow (dashboard, documents, customers,
 * settings) is gated behind both steps. Assumes RootLayout already
 * resolved 'loading'.
 */
export function RequireCompany() {
  const status = useCompanyStore((state) => state.status)
  const company = useCompanyStore((state) => state.company)

  if (status === 'no_company') {
    return <Navigate to="/onboarding/company" replace />
  }
  if (company && company.documentTemplate === null) {
    return <Navigate to="/onboarding/template" replace />
  }
  return <Outlet />
}
