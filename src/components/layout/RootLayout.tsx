import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { FullPageSpinner } from '@/components/shared/FullPageSpinner'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'

/**
 * Mounted once above every route. Bootstraps the auth session, then the
 * signed-in user's company, before any page renders — so RequireAuth /
 * RedirectIfAuthed / RequireCompany / RequireNoCompany never see a
 * 'loading' status, only the resolved states they actually branch on.
 */
export function RootLayout() {
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const initializeAuth = useAuthStore((state) => state.initialize)
  const companyStatus = useCompanyStore((state) => state.status)
  const syncCompanyForUser = useCompanyStore((state) => state.syncForUser)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (authStatus === 'loading') return
    void syncCompanyForUser(authStatus === 'authenticated' ? (user?.id ?? null) : null)
  }, [authStatus, user?.id, syncCompanyForUser])

  const isBootstrapping =
    authStatus === 'loading' || (authStatus === 'authenticated' && companyStatus === 'loading')

  if (isBootstrapping) return <FullPageSpinner />
  return <Outlet />
}
