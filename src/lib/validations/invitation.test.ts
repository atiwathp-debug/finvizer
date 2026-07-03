import { describe, expect, it } from 'vitest'
import { inviteMemberSchema } from './invitation'

describe('inviteMemberSchema', () => {
  it('accepts a valid email and assignable role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a@example.com', role: 'EDITOR' }).success).toBe(
      true,
    )
  })

  it('rejects OWNER as an invite role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a@example.com', role: 'OWNER' }).success).toBe(
      false,
    )
  })

  it('rejects an invalid email', () => {
    expect(
      inviteMemberSchema.safeParse({ email: 'not-an-email', role: 'EDITOR' }).success,
    ).toBe(false)
  })
})
