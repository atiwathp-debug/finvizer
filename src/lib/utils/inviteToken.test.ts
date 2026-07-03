import { describe, expect, it } from 'vitest'
import { generateInviteToken, hashInviteToken } from './inviteToken'

describe('generateInviteToken', () => {
  it('generates a URL-safe, sufficiently long random token', () => {
    const token = generateInviteToken()
    expect(token).toMatch(/^[a-f0-9]+$/)
    expect(token.length).toBeGreaterThanOrEqual(60)
  })

  it('generates different tokens each call', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken())
  })
})

describe('hashInviteToken', () => {
  it('produces a deterministic 64-char hex SHA-256 hash', async () => {
    const hash = await hashInviteToken('same-token')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await hashInviteToken('same-token')).toBe(hash)
  })

  it('produces different hashes for different tokens', async () => {
    const a = await hashInviteToken('token-a')
    const b = await hashInviteToken('token-b')
    expect(a).not.toBe(b)
  })
})
