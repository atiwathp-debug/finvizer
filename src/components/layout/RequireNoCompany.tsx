import { Navigate, Outlet } from 'react-router-dom'
import { useCompanyStore } from '@/stores/companyStore'

/** Sends users who already have a company away from onboarding. Assumes RootLayout already resolved 'loading'. */
export function RequireNoCompany() {
  const status = useCompanyStore((state) => state.status)

  if (status === 'has_company') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
