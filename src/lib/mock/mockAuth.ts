import type { AuthUser } from '@/types/auth'

const USERS_KEY = 'finvizer_mock_auth_users'
const SESSION_KEY = 'finvizer_mock_auth_session'
const PENDING_RESET_KEY = 'finvizer_mock_auth_pending_reset'

/** Exposed so auth.ts can listen for cross-tab session changes via the storage event. */
export const MOCK_SESSION_STORAGE_KEY = SESSION_KEY

interface StoredMockUser {
  id: string
  email: string
  displayName: string
  salt: string
  passwordHash: string
  createdAt: string
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

/**
 * Mock Mode has no real backend, but we still avoid storing plaintext
 * passwords in localStorage — same discipline as Supabase Auth's hashing,
 * just simulated locally with a per-user salt + SHA-256.
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64(digest)
}

function generateSalt(): string {
  return crypto.randomUUID()
}

function readUsers(): StoredMockUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as StoredMockUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredMockUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function toAuthUser(stored: StoredMockUser): AuthUser {
  return {
    id: stored.id,
    email: stored.email,
    displayName: stored.displayName,
    // Mock Mode has no real email delivery — accounts are always "confirmed"
    // so the demo flow isn't blocked. Production email verification only
    // applies once a real Supabase project is connected.
    emailConfirmed: true,
  }
}

export function getMockSession(): AuthUser | null {
  const userId = localStorage.getItem(SESSION_KEY)
  if (!userId) return null
  const user = readUsers().find((u) => u.id === userId)
  return user ? toAuthUser(user) : null
}

/** Used by lib/mock/mockMembers.ts to display email/displayName for a company_members row. */
export function findMockUserById(userId: string): AuthUser | null {
  const user = readUsers().find((u) => u.id === userId)
  return user ? toAuthUser(user) : null
}

function setMockSession(userId: string | null) {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId)
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export async function registerMockUser(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthUser> {
  const users = readUsers()
  const normalizedEmail = email.trim().toLowerCase()
  if (users.some((u) => u.email === normalizedEmail)) {
    throw new Error('อีเมลนี้ถูกใช้งานแล้ว')
  }

  const salt = generateSalt()
  const passwordHash = await hashPassword(password, salt)
  const newUser: StoredMockUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    displayName,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  }
  writeUsers([...users, newUser])
  setMockSession(newUser.id)
  return toAuthUser(newUser)
}

export async function loginMockUser(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const user = readUsers().find((u) => u.email === normalizedEmail)
  // Generic message for both "no such user" and "wrong password" — mirrors
  // Supabase's own "Invalid login credentials" to avoid leaking which field
  // is wrong.
  const invalidCredentialsError = new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  if (!user) throw invalidCredentialsError

  const candidateHash = await hashPassword(password, user.salt)
  if (candidateHash !== user.passwordHash) throw invalidCredentialsError

  setMockSession(user.id)
  return toAuthUser(user)
}

export function logoutMock() {
  setMockSession(null)
}

/** Used by lib/mock/mockAccount.ts — permanently removes the local user record (Delete Account). */
export function deleteMockUser(userId: string): void {
  writeUsers(readUsers().filter((u) => u.id !== userId))
  if (localStorage.getItem(SESSION_KEY) === userId) {
    setMockSession(null)
  }
}

/**
 * Mock Mode can't send real emails, so the forgot/reset password pages
 * hand the target email off to each other via sessionStorage — this keeps
 * the whole flow testable end-to-end without a backend, and mirrors what a
 * real emailed reset link would carry (a token identifying the account).
 */
export function requestMockPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const exists = readUsers().some((u) => u.email === normalizedEmail)
  // Always store the token even if the account doesn't exist, so the UI
  // behaves identically either way (no user enumeration).
  if (exists) {
    sessionStorage.setItem(PENDING_RESET_KEY, normalizedEmail)
  }
}

export function consumePendingMockReset(): string | null {
  return sessionStorage.getItem(PENDING_RESET_KEY)
}

export async function resetMockPassword(email: string, newPassword: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const users = readUsers()
  const index = users.findIndex((u) => u.email === normalizedEmail)
  if (index === -1) {
    throw new Error('ไม่พบบัญชีผู้ใช้นี้')
  }

  const salt = generateSalt()
  const passwordHash = await hashPassword(newPassword, salt)
  users[index] = { ...users[index], salt, passwordHash }
  writeUsers(users)
  sessionStorage.removeItem(PENDING_RESET_KEY)
}
