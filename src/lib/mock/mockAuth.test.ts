import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumePendingMockReset,
  getMockSession,
  loginMockUser,
  logoutMock,
  registerMockUser,
  requestMockPasswordReset,
  resetMockPassword,
} from './mockAuth'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('registerMockUser', () => {
  it('creates a user, logs them in, and never stores the plaintext password', async () => {
    const user = await registerMockUser('user@example.com', 'password123', 'สมชาย ใจดี')

    expect(user.email).toBe('user@example.com')
    expect(user.displayName).toBe('สมชาย ใจดี')
    expect(user.emailConfirmed).toBe(true)
    expect(getMockSession()?.id).toBe(user.id)

    const rawUsers = localStorage.getItem('finvizer_mock_auth_users') ?? '[]'
    expect(rawUsers).not.toContain('password123')
  })

  it('rejects a duplicate email', async () => {
    await registerMockUser('dupe@example.com', 'password123', 'A')
    await expect(registerMockUser('dupe@example.com', 'different1', 'B')).rejects.toThrow(
      'อีเมลนี้ถูกใช้งานแล้ว',
    )
  })

  it('is case-insensitive on email', async () => {
    await registerMockUser('CasedEmail@Example.com', 'password123', 'A')
    await expect(
      registerMockUser('casedemail@example.com', 'different1', 'B'),
    ).rejects.toThrow('อีเมลนี้ถูกใช้งานแล้ว')
  })
})

describe('loginMockUser', () => {
  it('logs in with correct credentials', async () => {
    await registerMockUser('login@example.com', 'password123', 'สมชาย')
    logoutMock()
    expect(getMockSession()).toBeNull()

    const user = await loginMockUser('login@example.com', 'password123')
    expect(user.email).toBe('login@example.com')
    expect(getMockSession()?.email).toBe('login@example.com')
  })

  it('rejects an unknown email with a generic message', async () => {
    await expect(loginMockUser('nobody@example.com', 'password123')).rejects.toThrow(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    )
  })

  it('rejects a wrong password with the same generic message', async () => {
    await registerMockUser('wrongpw@example.com', 'password123', 'สมชาย')
    await expect(loginMockUser('wrongpw@example.com', 'incorrect1')).rejects.toThrow(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    )
  })
})

describe('logoutMock', () => {
  it('clears the session', async () => {
    await registerMockUser('logout@example.com', 'password123', 'สมชาย')
    expect(getMockSession()).not.toBeNull()
    logoutMock()
    expect(getMockSession()).toBeNull()
  })
})

describe('password reset flow', () => {
  it('hands the email off via sessionStorage and lets the password be changed', async () => {
    await registerMockUser('reset@example.com', 'password123', 'สมชาย')
    logoutMock()

    requestMockPasswordReset('reset@example.com')
    expect(consumePendingMockReset()).toBe('reset@example.com')

    await resetMockPassword('reset@example.com', 'newpassword1')
    expect(consumePendingMockReset()).toBeNull()

    await expect(loginMockUser('reset@example.com', 'password123')).rejects.toThrow()
    const user = await loginMockUser('reset@example.com', 'newpassword1')
    expect(user.email).toBe('reset@example.com')
  })

  it('does not set a pending reset token for an unknown email (no enumeration)', () => {
    requestMockPasswordReset('unknown@example.com')
    expect(consumePendingMockReset()).toBeNull()
  })
})
