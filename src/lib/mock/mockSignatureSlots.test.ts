import { beforeEach, describe, expect, it } from 'vitest'
import { listMockSignatureSlots, saveMockSignatureSlots } from './mockSignatureSlots'

beforeEach(() => {
  localStorage.clear()
})

describe('listMockSignatureSlots', () => {
  it('returns an empty list for a company with no configured slots', () => {
    expect(listMockSignatureSlots('company-1')).toHaveLength(0)
  })

  it('only returns slots belonging to the given company', () => {
    saveMockSignatureSlots('company-1', [{ label: 'ผู้ซื้อ', sortOrder: 0, isDefault: true }])
    saveMockSignatureSlots('company-2', [{ label: 'ผู้ขาย', sortOrder: 0, isDefault: true }])

    expect(listMockSignatureSlots('company-1').map((s) => s.label)).toEqual(['ผู้ซื้อ'])
    expect(listMockSignatureSlots('company-2').map((s) => s.label)).toEqual(['ผู้ขาย'])
  })

  it('returns slots in sortOrder', () => {
    saveMockSignatureSlots('company-1', [
      { label: 'ผู้ขาย', sortOrder: 1, isDefault: true },
      { label: 'ผู้ซื้อ', sortOrder: 0, isDefault: true },
    ])

    expect(listMockSignatureSlots('company-1').map((s) => s.label)).toEqual(['ผู้ซื้อ', 'ผู้ขาย'])
  })
})

describe('saveMockSignatureSlots', () => {
  it('replaces the full list instead of appending', () => {
    saveMockSignatureSlots('company-1', [{ label: 'ผู้ซื้อ', sortOrder: 0, isDefault: true }])

    saveMockSignatureSlots('company-1', [
      { label: 'ผู้จัดทำ', sortOrder: 0, isDefault: false },
      { label: 'ผู้ตรวจสอบ', sortOrder: 1, isDefault: false },
      { label: 'ผู้อนุมัติ', sortOrder: 2, isDefault: false },
    ])

    expect(listMockSignatureSlots('company-1').map((s) => s.label)).toEqual([
      'ผู้จัดทำ',
      'ผู้ตรวจสอบ',
      'ผู้อนุมัติ',
    ])
  })

  it('does not affect another company\'s saved slots', () => {
    saveMockSignatureSlots('company-2', [{ label: 'ผู้ขาย', sortOrder: 0, isDefault: true }])

    saveMockSignatureSlots('company-1', [{ label: 'ผู้ซื้อ', sortOrder: 0, isDefault: true }])

    expect(listMockSignatureSlots('company-2').map((s) => s.label)).toEqual(['ผู้ขาย'])
  })
})
