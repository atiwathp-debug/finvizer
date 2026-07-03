export interface AuthUser {
  id: string
  email: string
  displayName: string
  emailConfirmed: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/** Returned by sign-up so the UI can decide whether to show the "check your email" screen. */
export interface SignUpResult {
  user: AuthUser
  /** True when the project requires email confirmation before a session is issued. */
  requiresEmailConfirmation: boolean
}
