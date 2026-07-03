import { beforeEach, describe, expect, it } from 'vitest'
import { incrementMockSequence } from './mockNumberingSequences'

beforeEach(() => {
  localStorage.clear()
})

describe('incrementMockSequence', () => {
  it('starts a new sequence at 1', () => {
    expect(incrementMockSequence('company-1', 'QUOTATION', '202607')).toBe(1)
  })

  it('increments on each subsequent call for the same key', () => {
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    expect(incrementMockSequence('company-1', 'QUOTATION', '202607')).toBe(3)
  })

  it('keeps separate counters per document type', () => {
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    expect(incrementMockSequence('company-1', 'INVOICE', '202607')).toBe(1)
  })

  it('keeps separate counters per sequence key (reset bucket)', () => {
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    expect(incrementMockSequence('company-1', 'QUOTATION', '202608')).toBe(1)
  })

  it('keeps separate counters per company', () => {
    incrementMockSequence('company-1', 'QUOTATION', '202607')
    expect(incrementMockSequence('company-2', 'QUOTATION', '202607')).toBe(1)
  })
})
