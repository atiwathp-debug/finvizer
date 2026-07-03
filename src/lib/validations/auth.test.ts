import { describe, expect, it } from 'vitest'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth'

describe('loginSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'anything' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'anything' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const base = {
    displayName: 'สมชาย ใจดี',
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  }

  it('accepts matching strong passwords', () => {
    expect(registerSchema.safeParse(base).success).toBe(true)
  })

  it('rejects mismatched confirmPassword', () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: 'different123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...base, password: 'ab1', confirmPassword: 'ab1' })
    expect(result.success).toBe(false)
  })

  it('rejects a password with no digit', () => {
    const result = registerSchema.safeParse({
      ...base,
      password: 'onlyletters',
      confirmPassword: 'onlyletters',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty display name', () => {
    const result = registerSchema.safeParse({ ...base, displayName: '' })
    expect(result.success).toBe(false)
  })
})

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'password123',
      confirmPassword: 'password124',
    })
    expect(result.success).toBe(false)
  })

  it('accepts matching strong passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'password123',
      confirmPassword: 'password123',
    })
    expect(result.success).toBe(true)
  })
})
