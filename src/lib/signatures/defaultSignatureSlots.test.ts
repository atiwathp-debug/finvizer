import { describe, expect, it } from 'vitest'
import { withSignatureFallback } from './defaultSignatureSlots'
import type { SignatureSlot } from '@/types/signature'

describe('withSignatureFallback', () => {
  it('falls back to ผู้ซื้อ/ผู้ขาย when given an empty list', () => {
    const slots = withSignatureFallback([])
    expect(slots.map((s) => s.label)).toEqual(['ผู้ซื้อ', 'ผู้ขาย'])
  })

  it('passes through a company-configured list unchanged', () => {
    const configured: SignatureSlot[] = [
      {
        id: 'slot-1',
        companyId: 'company-1',
        label: 'ผู้จัดทำ',
        sortOrder: 0,
        isDefault: false,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'slot-2',
        companyId: 'company-1',
        label: 'ผู้อนุมัติ',
        sortOrder: 1,
        isDefault: false,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]

    expect(withSignatureFallback(configured)).toEqual(configured)
  })

  it('never returns an empty list', () => {
    expect(withSignatureFallback([]).length).toBeGreaterThan(0)
  })
})
