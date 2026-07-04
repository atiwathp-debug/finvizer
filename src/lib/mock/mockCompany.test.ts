import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMockCompany,
  getMockCompanyForUser,
  updateMockCompany,
  updateMockCompanyLogo,
  updateMockCompanyTemplate,
  type MockCompanyOnboardingInput,
} from './mockCompany'

beforeEach(() => {
  localStorage.clear()
})

const input: MockCompanyOnboardingInput = {
  nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด',
  nameEn: 'Demo Trading Co., Ltd.',
  companyCode: 'DEMO',
  taxId: '0105561000001',
  address: '99/9 ถนนสุขุมวิท กรุงเทพมหานคร',
  phone: '02-123-4567',
  email: 'contact@demotrading.example',
  contactName: 'สมชาย ใจดี',
}

describe('createMockCompany', () => {
  it('creates a company owned by the given user, defaulting branch to HQ', () => {
    const company = createMockCompany('user-1', input)
    expect(company.ownerId).toBe('user-1')
    expect(company.branchCode).toBe('HQ')
    expect(company.branchName).toBe('สำนักงานใหญ่')
    expect(company.documentTemplate).toBeNull()

    const membership = getMockCompanyForUser('user-1')
    expect(membership?.company.id).toBe(company.id)
    expect(membership?.role).toBe('OWNER')
  })

  it('rejects a second company for a user who already has one', () => {
    createMockCompany('user-1', input)
    expect(() => createMockCompany('user-1', input)).toThrow('คุณมีบริษัทอยู่แล้ว')
  })

  it('lets different users each create their own company', () => {
    const a = createMockCompany('user-1', input)
    const b = createMockCompany('user-2', { ...input, companyCode: 'OTHR' })
    expect(a.id).not.toBe(b.id)
    expect(getMockCompanyForUser('user-2')?.company.companyCode).toBe('OTHR')
  })
})

describe('updateMockCompany', () => {
  it('updates editable fields and bumps updatedAt', async () => {
    const company = createMockCompany('user-1', input)
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = updateMockCompany(company.id, {
      nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด (แก้ไข)',
      nameEn: '',
      taxId: company.taxId,
      address: 'ที่อยู่ใหม่',
      phone: company.phone ?? '',
      email: company.email ?? '',
      contactName: company.contactName ?? '',
    })

    expect(updated.nameTh).toBe('บริษัท เดโม เทรดดิ้ง จำกัด (แก้ไข)')
    expect(updated.nameEn).toBeNull()
    expect(updated.address).toBe('ที่อยู่ใหม่')
    expect(updated.companyCode).toBe(company.companyCode)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(company.updatedAt).getTime(),
    )
  })

  it('throws for an unknown company id', () => {
    expect(() =>
      updateMockCompany('missing-id', {
        nameTh: 'x',
        nameEn: '',
        taxId: '0000000000000',
        address: 'x',
        phone: 'x',
        email: 'x@example.com',
        contactName: 'x',
      }),
    ).toThrow('ไม่พบบริษัท')
  })
})

describe('updateMockCompanyTemplate', () => {
  it('starts with no template selected', () => {
    const company = createMockCompany('user-1', input)
    expect(company.documentTemplate).toBeNull()
  })

  it('sets the document template and bumps updatedAt', async () => {
    const company = createMockCompany('user-1', input)
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = updateMockCompanyTemplate(company.id, 'EXECUTIVE_CLASSIC')

    expect(updated.documentTemplate).toBe('EXECUTIVE_CLASSIC')
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(company.updatedAt).getTime(),
    )
    expect(getMockCompanyForUser('user-1')?.company.documentTemplate).toBe('EXECUTIVE_CLASSIC')
  })

  it('can be changed again later (Settings > Templates)', () => {
    const company = createMockCompany('user-1', input)
    updateMockCompanyTemplate(company.id, 'EXECUTIVE_CLASSIC')

    const updated = updateMockCompanyTemplate(company.id, 'MODERN_ACCENT')

    expect(updated.documentTemplate).toBe('MODERN_ACCENT')
  })

  it('throws for an unknown company id', () => {
    expect(() => updateMockCompanyTemplate('missing-id', 'MODERN_ACCENT')).toThrow('ไม่พบบริษัท')
  })
})

describe('updateMockCompanyLogo', () => {
  it('starts with no logo set', () => {
    const company = createMockCompany('user-1', input)
    expect(company.logoUrl).toBeNull()
  })

  it('sets the logo as a data URL and bumps updatedAt', async () => {
    const company = createMockCompany('user-1', input)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

    const updated = updateMockCompanyLogo(company.id, dataUrl)

    expect(updated.logoUrl).toBe(dataUrl)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(company.updatedAt).getTime(),
    )
    expect(getMockCompanyForUser('user-1')?.company.logoUrl).toBe(dataUrl)
  })

  it('clears the logo back to null on remove', () => {
    const company = createMockCompany('user-1', input)
    updateMockCompanyLogo(company.id, 'data:image/png;base64,iVBORw0KGgo=')

    const cleared = updateMockCompanyLogo(company.id, null)

    expect(cleared.logoUrl).toBeNull()
  })

  it('throws for an unknown company id', () => {
    expect(() => updateMockCompanyLogo('missing-id', 'data:image/png;base64,x')).toThrow('ไม่พบบริษัท')
  })
})
