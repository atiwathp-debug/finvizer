import { describe, expect, it } from 'vitest'
import { companyOnboardingSchema, companySettingsSchema } from './company'

const validOnboarding = {
  nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด',
  nameEn: 'Demo Trading Co., Ltd.',
  companyCode: 'demo',
  taxId: '0105561000001',
  address: '99/9 ถนนสุขุมวิท กรุงเทพมหานคร',
  phone: '02-123-4567',
  email: 'contact@demotrading.example',
  contactName: 'สมชาย ใจดี',
}

describe('companyOnboardingSchema', () => {
  it('accepts valid input and uppercases companyCode', () => {
    const result = companyOnboardingSchema.safeParse(validOnboarding)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.companyCode).toBe('DEMO')
    }
  })

  it('allows an empty English name', () => {
    const result = companyOnboardingSchema.safeParse({ ...validOnboarding, nameEn: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a tax ID that is not exactly 13 digits', () => {
    expect(companyOnboardingSchema.safeParse({ ...validOnboarding, taxId: '123' }).success).toBe(
      false,
    )
    expect(
      companyOnboardingSchema.safeParse({ ...validOnboarding, taxId: '01055610000012' }).success,
    ).toBe(false)
  })

  it('rejects a company code with symbols', () => {
    const result = companyOnboardingSchema.safeParse({ ...validOnboarding, companyCode: 'DE-MO' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing Thai name', () => {
    expect(companyOnboardingSchema.safeParse({ ...validOnboarding, nameTh: '' }).success).toBe(
      false,
    )
  })

  it('rejects an invalid email', () => {
    expect(
      companyOnboardingSchema.safeParse({ ...validOnboarding, email: 'not-an-email' }).success,
    ).toBe(false)
  })
})

describe('companySettingsSchema', () => {
  it('validates the field set without companyCode', () => {
    const { companyCode, ...rest } = validOnboarding
    expect(companyCode).toBe('demo')
    expect(companySettingsSchema.safeParse(rest).success).toBe(true)
  })
})
