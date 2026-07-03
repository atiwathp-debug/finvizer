import { beforeEach, describe, expect, it } from 'vitest'
import { getMockSession, loginMockUser, registerMockUser } from './mockAuth'
import { addMockMember, getMockMembersForCompany, getMockMembershipForUser } from './mockMembers'
import { createMockCompany, getMockCompanyForUser } from './mockCompany'
import { createMockInvitation, listMockInvitations } from './mockInvitations'
import { deleteMockAccount } from './mockAccount'

beforeEach(() => {
  localStorage.clear()
})

const companyInput = {
  nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด',
  nameEn: 'Demo Trading Co., Ltd.',
  companyCode: 'DEMO',
  taxId: '0105561000001',
  address: '99/9 ถนนสุขุมวิท กรุงเทพมหานคร',
  phone: '02-123-4567',
  email: 'contact@demotrading.example',
  contactName: 'สมชาย ใจดี',
}

describe('deleteMockAccount', () => {
  it('OWNER deletion removes the company, every member, every invitation, and the user itself', async () => {
    const owner = await registerMockUser('owner@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    const editor = await registerMockUser('editor@example.com', 'password123', 'Editor')
    addMockMember(company.id, editor.id, 'EDITOR')
    createMockInvitation(company.id, 'pending@example.com', 'VIEWER', owner.id, 'hash-1')

    deleteMockAccount(owner.id)

    expect(getMockCompanyForUser(owner.id)).toBeNull()
    expect(getMockMembersForCompany(company.id)).toHaveLength(0)
    expect(listMockInvitations(company.id)).toHaveLength(0)
    // The editor's own membership was also revoked, since the whole company is gone.
    expect(getMockMembershipForUser(editor.id)).toBeNull()
    await expect(loginMockUser('owner@example.com', 'password123')).rejects.toThrow(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    )
  })

  it('non-owner deletion only removes their own membership and account', async () => {
    const owner = await registerMockUser('owner2@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    const editor = await registerMockUser('editor2@example.com', 'password123', 'Editor')
    addMockMember(company.id, editor.id, 'EDITOR')

    deleteMockAccount(editor.id)

    expect(getMockMembershipForUser(editor.id)).toBeNull()
    expect(getMockCompanyForUser(owner.id)?.company.id).toBe(company.id)
    expect(getMockMembersForCompany(company.id)).toHaveLength(1)
    await expect(loginMockUser('editor2@example.com', 'password123')).rejects.toThrow(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    )
  })

  it('clears the active session when the currently logged-in user deletes their own account', async () => {
    const owner = await registerMockUser('owner3@example.com', 'password123', 'Owner')
    createMockCompany(owner.id, companyInput)

    deleteMockAccount(owner.id)

    expect(getMockSession()).toBeNull()
  })

  it('is safe to call for a user with no company at all', async () => {
    const user = await registerMockUser('lonely@example.com', 'password123', 'Lonely')
    expect(() => deleteMockAccount(user.id)).not.toThrow()
    expect(getMockSession()).toBeNull()
  })
})
