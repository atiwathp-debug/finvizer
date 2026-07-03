import { describe, expect, it } from 'vitest'
import { computeSequenceKey } from './sequenceKey'

const at = new Date('2026-07-01T10:30:00')

describe('computeSequenceKey', () => {
  it('DAILY buckets by YYYYMMDD', () => {
    expect(computeSequenceKey('DAILY', at)).toBe('20260701')
  })

  it('MONTHLY buckets by YYYYMM', () => {
    expect(computeSequenceKey('MONTHLY', at)).toBe('202607')
  })

  it('YEARLY buckets by YYYY', () => {
    expect(computeSequenceKey('YEARLY', at)).toBe('2026')
  })

  it('NEVER always returns the same constant bucket', () => {
    expect(computeSequenceKey('NEVER', at)).toBe('ALL')
    expect(computeSequenceKey('NEVER', new Date('2030-01-01'))).toBe('ALL')
  })

  it('DAILY produces a different key on a different day', () => {
    expect(computeSequenceKey('DAILY', new Date('2026-07-02T00:00:00'))).not.toBe(
      computeSequenceKey('DAILY', at),
    )
  })

  it('MONTHLY stays the same across days within the same month', () => {
    expect(computeSequenceKey('MONTHLY', new Date('2026-07-31T23:59:00'))).toBe(
      computeSequenceKey('MONTHLY', at),
    )
  })

  it('YEARLY stays the same across months within the same year', () => {
    expect(computeSequenceKey('YEARLY', new Date('2026-12-31T23:59:00'))).toBe(
      computeSequenceKey('YEARLY', at),
    )
  })

  it('pads single-digit months and days', () => {
    expect(computeSequenceKey('DAILY', new Date('2026-01-05T00:00:00'))).toBe('20260105')
  })
})
