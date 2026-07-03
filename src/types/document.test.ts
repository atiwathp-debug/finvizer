import { describe, expect, it } from 'vitest'
import { canConvertDocumentType, documentConversionMap, revisionLabel } from './document'
import type { DocumentType } from './document'

describe('documentConversionMap', () => {
  it('is a directed acyclic graph — no document type can eventually reach itself', () => {
    const allTypes = Object.keys(documentConversionMap) as DocumentType[]
    for (const start of allTypes) {
      const visited = new Set<DocumentType>()
      const stack: DocumentType[] = [...documentConversionMap[start]]
      while (stack.length > 0) {
        const current = stack.pop()
        if (!current) continue
        expect(current).not.toBe(start)
        if (visited.has(current)) continue
        visited.add(current)
        stack.push(...documentConversionMap[current])
      }
    }
  })

  it('has the documented example conversions available', () => {
    expect(documentConversionMap.QUOTATION).toContain('INVOICE')
    expect(documentConversionMap.INVOICE).toContain('RECEIPT')
    expect(documentConversionMap.INVOICE).toContain('TAX_INVOICE')
    expect(documentConversionMap.RECEIPT).toContain('RECEIPT_TAX_INVOICE')
    expect(documentConversionMap.TAX_INVOICE).toContain('CREDIT_NOTE')
    expect(documentConversionMap.TAX_INVOICE).toContain('CREDIT_NOTE_TAX')
  })

  it('has no outgoing conversions from the terminal credit-note types', () => {
    expect(documentConversionMap.CREDIT_NOTE).toEqual([])
    expect(documentConversionMap.CREDIT_NOTE_TAX).toEqual([])
  })
})

describe('canConvertDocumentType', () => {
  it('allows a documented conversion', () => {
    expect(canConvertDocumentType('QUOTATION', 'INVOICE')).toBe(true)
  })

  it('blocks an undocumented conversion', () => {
    expect(canConvertDocumentType('QUOTATION', 'RECEIPT')).toBe(false)
    expect(canConvertDocumentType('RFQ', 'INVOICE')).toBe(false)
  })

  it('blocks converting backwards (would create a cycle)', () => {
    expect(canConvertDocumentType('INVOICE', 'QUOTATION')).toBe(false)
    expect(canConvertDocumentType('RECEIPT', 'INVOICE')).toBe(false)
  })

  it('blocks converting a type to itself', () => {
    expect(canConvertDocumentType('INVOICE', 'INVOICE')).toBe(false)
  })
})

describe('revisionLabel', () => {
  it('formats a revision number as R{n}', () => {
    expect(revisionLabel(1)).toBe('R1')
    expect(revisionLabel(2)).toBe('R2')
  })

  it('returns null for a document with no revision number', () => {
    expect(revisionLabel(null)).toBeNull()
  })
})
