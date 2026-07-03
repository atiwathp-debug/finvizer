import type { User } from '@supabase/supabase-js'
import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  getMockSession,
  loginMockUser,
  logoutMock,
  MOCK_SESSION_STORAGE_KEY,
  registerMockUser,
  requestMockPasswordReset,
  resetMockPassword,
} from '@/lib/mock/mockAuth'
import { logError } from '@/lib/utils/debugLog'
import { buildAppUrl } from '@/lib/utils/url'
import type { AuthUser, SignUpResult } from '@/types/auth'

function mapSupabaseUser(user: User): AuthUser {
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'ผู้ใช้งาน'
  return {
    id: user.id,
    email: user.email ?? '',
    displayName,
    emailConfirmed: Boolean(user.email_confirmed_at),
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (isMockMode) {
    return loginMockUser(email, password)
  }
  try {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('เข้าสู่ระบบไม่สำเร็จ')
    return mapSupabaseUser(data.user)
  } catch (error) {
    logError('auth.signIn', error, { email })
    throw error
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<SignUpResult> {
  if (isMockMode) {
    const user = await registerMockUser(email, password, displayName)
    return { user, requiresEmailConfirmation: false }
  }
  try {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: buildAppUrl('login'),
      },
    })
    if (error) throw error
    if (!data.user) throw new Error('ไม่สามารถสมัครสมาชิกได้')
    return { user: mapSupabaseUser(data.user), requiresEmailConfirmation: !data.session }
  } catch (error) {
    logError('auth.signUp', error, { email })
    throw error
  }
}

export async function signOut(): Promise<void> {
  if (isMockMode) {
    logoutMock()
    return
  }
  try {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  } catch (error) {
    logError('auth.signOut', error)
    throw error
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (isMockMode) {
    requestMockPasswordReset(email)
    return
  }
  try {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: buildAppUrl('reset-password'),
    })
    if (error) throw error
  } catch (error) {
    logError('auth.requestPasswordReset', error, { email })
    throw error
  }
}

/**
 * Mock Mode has no session to attach a password update to, so it needs the
 * target email explicitly (handed off from ForgotPasswordPage). Real mode
 * uses the temporary recovery session Supabase establishes when the user
 * follows the emailed reset link.
 */
export async function updatePassword(newPassword: string, mockEmail?: string | null): Promise<void> {
  if (isMockMode) {
    if (!mockEmail) {
      throw new Error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ')
    }
    await resetMockPassword(mockEmail, newPassword)
    return
  }
  try {
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword })
    if (error) throw error
  } catch (error) {
    logError('auth.updatePassword', error)
    throw error
  }
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  if (isMockMode) return
  try {
    const { error } = await requireSupabase().auth.resend({ type: 'signup', email })
    if (error) throw error
  } catch (error) {
    logError('auth.resendConfirmationEmail', error, { email })
    throw error
  }
}

export async function getInitialAuthUser(): Promise<AuthUser | null> {
  if (isMockMode) return getMockSession()
  try {
    const { data, error } = await requireSupabase().auth.getSession()
    if (error) throw error
    return data.session?.user ? mapSupabaseUser(data.session.user) : null
  } catch (error) {
    logError('auth.getInitialAuthUser', error)
    return null
  }
}

/** Returns an unsubscribe function. */
export function subscribeToAuthChanges(onChange: (user: AuthUser | null) => void): () => void {
  if (isMockMode) {
    const handler = (event: StorageEvent) => {
      if (event.key === MOCK_SESSION_STORAGE_KEY || event.key === null) {
        onChange(getMockSession())
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }

  const {
    data: { subscription },
  } = requireSupabase().auth.onAuthStateChange((_event, session) => {
    onChange(session?.user ? mapSupabaseUser(session.user) : null)
  })
  return () => subscription.unsubscribe()
}
