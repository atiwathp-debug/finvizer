import { beforeEach, describe, expect, it } from 'vitest'
import { registerMockUser } from './mockAuth'
import {
  addMockMember,
  countActiveNonOwnerMembers,
  getMockMembersForCompany,
  getMockMembershipForUser,
  removeMockMember,
  updateMockMemberRole,
} from './mockMembers'

beforeEach(() => {
  localStorage.clear()
})

describe('addMockMember / getMockMembershipForUser', () => {
  it('adds a member and reports their membership', async () => {
    const owner = await registerMockUser('owner@example.com', 'password123', 'Owner')
    addMockMember('company-1', owner.id, 'OWNER')

    expect(getMockMembershipForUser(owner.id)).toEqual({ companyId: 'company-1', role: 'OWNER' })
  })

  it('rejects adding a user who already belongs to a company', async () => {
    const user = await registerMockUser('user@example.com', 'password123', 'User')
    addMockMember('company-1', user.id, 'OWNER')

    expect(() => addMockMember('company-2', user.id, 'EDITOR')).toThrow(
      'ผู้ใช้นี้เป็นสมาชิกของบริษัทอื่นอยู่แล้ว',
    )
  })
})

describe('getMockMembersForCompany', () => {
  it('joins member rows with mock auth user email/displayName', async () => {
    const owner = await registerMockUser('owner2@example.com', 'password123', 'สมชาย')
    addMockMember('company-1', owner.id, 'OWNER')

    const members = getMockMembersForCompany('company-1')
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      userId: owner.id,
      email: 'owner2@example.com',
      displayName: 'สมชาย',
      role: 'OWNER',
      status: 'ACTIVE',
    })
  })
})

describe('countActiveNonOwnerMembers', () => {
  it('excludes the OWNER row from the count', async () => {
    const owner = await registerMockUser('owner3@example.com', 'password123', 'Owner')
    const editor = await registerMockUser('editor3@example.com', 'password123', 'Editor')
    addMockMember('company-1', owner.id, 'OWNER')
    addMockMember('company-1', editor.id, 'EDITOR')

    expect(countActiveNonOwnerMembers('company-1')).toBe(1)
  })
})

describe('updateMockMemberRole', () => {
  it('changes a non-owner member role', async () => {
    const owner = await registerMockUser('owner4@example.com', 'password123', 'Owner')
    const editor = await registerMockUser('editor4@example.com', 'password123', 'Editor')
    addMockMember('company-1', owner.id, 'OWNER')
    addMockMember('company-1', editor.id, 'EDITOR')

    const editorMember = getMockMembersForCompany('company-1').find((m) => m.userId === editor.id)
    updateMockMemberRole(editorMember!.id, 'ADMIN')

    const updated = getMockMembersForCompany('company-1').find((m) => m.userId === editor.id)
    expect(updated?.role).toBe('ADMIN')
  })

  it('refuses to change the OWNER row', async () => {
    const owner = await registerMockUser('owner5@example.com', 'password123', 'Owner')
    addMockMember('company-1', owner.id, 'OWNER')
    const ownerMember = getMockMembersForCompany('company-1')[0]

    expect(() => updateMockMemberRole(ownerMember.id, 'ADMIN')).toThrow(
      'ไม่สามารถเปลี่ยนสิทธิ์ของเจ้าของบริษัทได้',
    )
  })
})

describe('removeMockMember', () => {
  it('removes a non-owner member', async () => {
    const owner = await registerMockUser('owner6@example.com', 'password123', 'Owner')
    const editor = await registerMockUser('editor6@example.com', 'password123', 'Editor')
    addMockMember('company-1', owner.id, 'OWNER')
    addMockMember('company-1', editor.id, 'EDITOR')

    const editorMember = getMockMembersForCompany('company-1').find((m) => m.userId === editor.id)
    removeMockMember(editorMember!.id)

    expect(getMockMembersForCompany('company-1')).toHaveLength(1)
    expect(getMockMembershipForUser(editor.id)).toBeNull()
  })

  it('refuses to remove the OWNER row', async () => {
    const owner = await registerMockUser('owner7@example.com', 'password123', 'Owner')
    addMockMember('company-1', owner.id, 'OWNER')
    const ownerMember = getMockMembersForCompany('company-1')[0]

    expect(() => removeMockMember(ownerMember.id)).toThrow('ไม่สามารถลบเจ้าของบริษัทได้')
  })
})
