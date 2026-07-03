import { beforeEach, describe, expect, it } from 'vitest'
import { registerMockUser } from './mockAuth'
import { createMockCompany } from './mockCompany'
import {
  acceptMockInvitation,
  cancelMockInvitation,
  createMockInvitation,
  listMockInvitations,
} from './mockInvitations'

beforeEach(() => {
  localStorage.clear()
})

const companyInput = {
  nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด',
  nameEn: '',
  companyCode: 'DEMO',
  taxId: '0105561000001',
  address: 'ที่อยู่',
  phone: '02-000-0000',
  email: 'contact@demo.example',
  contactName: 'ผู้ติดต่อ',
}

describe('createMockInvitation', () => {
  it('creates a PENDING invitation without exposing the token hash', async () => {
    const owner = await registerMockUser('owner@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)

    const invitation = createMockInvitation(company.id, 'Invitee@Example.com', 'EDITOR', owner.id, 'hash1')
    expect(invitation.status).toBe('PENDING')
    expect(invitation.invitedEmail).toBe('invitee@example.com')
    expect('tokenHash' in invitation).toBe(false)
  })

  it('rejects a duplicate pending invite for the same email', async () => {
    const owner = await registerMockUser('owner2@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    createMockInvitation(company.id, 'dup@example.com', 'EDITOR', owner.id, 'hash1')

    expect(() =>
      createMockInvitation(company.id, 'dup@example.com', 'VIEWER', owner.id, 'hash2'),
    ).toThrow('มีคำเชิญที่ค้างอยู่สำหรับอีเมลนี้แล้ว')
  })

  it('rejects a 3rd invited email (2 max)', async () => {
    const owner = await registerMockUser('owner3@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    createMockInvitation(company.id, 'a@example.com', 'EDITOR', owner.id, 'hash-a')
    createMockInvitation(company.id, 'b@example.com', 'VIEWER', owner.id, 'hash-b')

    expect(() =>
      createMockInvitation(company.id, 'c@example.com', 'ADMIN', owner.id, 'hash-c'),
    ).toThrow('ครบจำนวนสูงสุดแล้ว')
  })
})

describe('cancelMockInvitation', () => {
  it('marks a pending invitation as cancelled', async () => {
    const owner = await registerMockUser('owner4@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    const invitation = createMockInvitation(company.id, 'x@example.com', 'EDITOR', owner.id, 'hash-x')

    cancelMockInvitation(invitation.id)

    const found = listMockInvitations(company.id).find((i) => i.id === invitation.id)
    expect(found?.status).toBe('CANCELLED')
  })
})

describe('acceptMockInvitation', () => {
  it('accepts a valid invite: creates membership and marks ACCEPTED', async () => {
    const owner = await registerMockUser('owner5@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    createMockInvitation(company.id, 'invitee5@example.com', 'EDITOR', owner.id, 'hash-5')

    const invitee = await registerMockUser('invitee5@example.com', 'password123', 'Invitee')
    const result = acceptMockInvitation('hash-5', invitee)

    expect(result.id).toBe(company.id)
    const found = listMockInvitations(company.id).find((i) => i.invitedEmail === 'invitee5@example.com')
    expect(found?.status).toBe('ACCEPTED')
    expect(found?.acceptedAt).not.toBeNull()
  })

  it('rejects when the logged-in email does not match the invited email', async () => {
    const owner = await registerMockUser('owner6@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    createMockInvitation(company.id, 'invitee6@example.com', 'EDITOR', owner.id, 'hash-6')

    const wrongUser = await registerMockUser('wrong6@example.com', 'password123', 'Wrong')
    expect(() => acceptMockInvitation('hash-6', wrongUser)).toThrow(
      'อีเมลของคุณไม่ตรงกับอีเมลที่ได้รับคำเชิญ',
    )
  })

  it('rejects when the user already belongs to another company', async () => {
    const owner = await registerMockUser('owner7@example.com', 'password123', 'Owner')
    const company = createMockCompany(owner.id, companyInput)
    createMockInvitation(company.id, 'invitee7@example.com', 'EDITOR', owner.id, 'hash-7')

    const invitee = await registerMockUser('invitee7@example.com', 'password123', 'Invitee')
    createMockCompany(invitee.id, { ...companyInput, companyCode: 'OTHR' })

    expect(() => acceptMockInvitation('hash-7', invitee)).toThrow(
      'คุณเป็นสมาชิกของบริษัทอื่นอยู่แล้ว',
    )
  })

  it('rejects an invalid or already-used token', async () => {
    const owner = await registerMockUser('owner8@example.com', 'password123', 'Owner')
    createMockCompany(owner.id, companyInput)
    const someUser = await registerMockUser('someone8@example.com', 'password123', 'Someone')

    expect(() => acceptMockInvitation('nonexistent-hash', someUser)).toThrow(
      'ลิงก์คำเชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว',
    )
  })
})
