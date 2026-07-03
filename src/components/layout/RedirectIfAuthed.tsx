import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface LocationState {
  from?: { pathname: string }
}

/**
 * Sends already-logged-in users away from login/register. Assumes
 * RootLayout already resolved 'loading'.
 *
 * Redirects to `from` (e.g. /invite/:token, set by InviteAcceptPage's
 * Login/Register links) instead of always /dashboard when present. This
 * isn't just a nicety — it closes a race: Login/RegisterPage also navigate
 * explicitly to `from` right after a successful sign-in, and if this guard
 * redirected to a *different* hardcoded target, whichever one "won" would
 * be arbitrary, and the /dashboard fallback further cascades through
 * RequireCompany for a new/invited user with no company yet, landing on
 * /onboarding/company instead of the invite page. Agreeing on the same
 * target here means both redirects converge on the correct destination
 * regardless of which one actually fires.
 */
export function RedirectIfAuthed() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'authenticated') {
    const state = location.state as LocationState | null
    return <Navigate to={state?.from?.pathname ?? '/dashboard'} replace />
  }
  return <Outlet />
}
