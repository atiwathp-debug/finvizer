import { describe, expect, it } from 'vitest'
import { mapAuthErrorMessage } from './authErrors'

describe('mapAuthErrorMessage', () => {
  it('maps "Email not confirmed" to EMAIL_NOT_CONFIRMED', () => {
    const result = mapAuthErrorMessage(new Error('Email not confirmed'))
    expect(result.code).toBe('EMAIL_NOT_CONFIRMED')
  })

  it('maps "Invalid login credentials" to INVALID_CREDENTIALS', () => {
    const result = mapAuthErrorMessage(new Error('Invalid login credentials'))
    expect(result.code).toBe('INVALID_CREDENTIALS')
  })

  it('maps duplicate registration errors to USER_EXISTS', () => {
    expect(mapAuthErrorMessage(new Error('User already registered')).code).toBe('USER_EXISTS')
    expect(mapAuthErrorMessage(new Error('อีเมลนี้ถูกใช้งานแล้ว')).code).toBe('USER_EXISTS')
  })

  it('maps rate limit errors to RATE_LIMITED', () => {
    expect(mapAuthErrorMessage(new Error('Too many requests')).code).toBe('RATE_LIMITED')
  })

  it('maps network errors to NETWORK', () => {
    expect(mapAuthErrorMessage(new Error('Failed to fetch')).code).toBe('NETWORK')
  })

  it('maps missing-session errors to SESSION_MISSING', () => {
    expect(mapAuthErrorMessage(new Error('Auth session missing')).code).toBe('SESSION_MISSING')
  })

  it('falls back to UNKNOWN with a generic Thai message', () => {
    const result = mapAuthErrorMessage(new Error('some unrecognized backend error'))
    expect(result.code).toBe('UNKNOWN')
    expect(result.message).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
  })

  it('handles non-Error values without throwing', () => {
    expect(() => mapAuthErrorMessage('plain string error')).not.toThrow()
    expect(() => mapAuthErrorMessage(undefined)).not.toThrow()
  })
})
