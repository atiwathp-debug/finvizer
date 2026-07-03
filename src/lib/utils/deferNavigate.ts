import type { NavigateFunction } from 'react-router-dom'

/**
 * Defers a react-router navigation to a macrotask so it wins any race
 * against a reactive route guard (RedirectIfAuthed) that also navigates in
 * response to the same authStore update — e.g. after Register, setUser()
 * flips status to 'authenticated' while location is still /register, so
 * RedirectIfAuthed fires its own redirect to /dashboard via a passive
 * effect. That effect always settles before a setTimeout(0) callback runs,
 * so calling navigate() here — after setUser() — is guaranteed to be the
 * final, authoritative navigation instead of losing the race.
 */
export function deferNavigate(navigate: NavigateFunction, to: string) {
  setTimeout(() => navigate(to, { replace: true }), 0)
}
