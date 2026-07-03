import { describe, expect, it } from 'vitest'
import { documentFormSchema, lineItemSchema } from './document'

const validItem = {
  description: 'ค่าบริการที่ปรึกษา',
  quantity: 1,
  unit: 'งาน',
  unitPrice: 1000,
  discountType: 'AMOUNT' as const,
  discountValue: 0,
}

const validDocument = {
  documentType: 'QUOTATION' as const,
  customerId: 'customer-1',
  vatMode: 'VAT_EXCLUDED' as const,
  issueDate: '2026-07-01',
  dueDate: '',
  note: '',
  documentDiscountType: 'AMOUNT' as const,
  documentDiscountValue: 0,
  items: [validItem],
}

describe('lineItemSchema', () => {
  it('accepts a valid line item', () => {
    expect(lineItemSchema.safeParse(validItem).success).toBe(true)
  })

  it('requires description', () => {
    expect(lineItemSchema.safeParse({ ...validItem, description: '' }).success).toBe(false)
  })

  it('requires quantity to be positive', () => {
    expect(lineItemSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false)
    expect(lineItemSchema.safeParse({ ...validItem, quantity: -1 }).success).toBe(false)
  })

  it('rejects a negative unit price', () => {
    expect(lineItemSchema.safeParse({ ...validItem, unitPrice: -1 }).success).toBe(false)
  })

  it('rejects a PERCENT discount over 100', () => {
    expect(
      lineItemSchema.safeParse({ ...validItem, discountType: 'PERCENT', discountValue: 101 }).success,
    ).toBe(false)
  })

  it('accepts a PERCENT discount of exactly 100', () => {
    expect(
      lineItemSchema.safeParse({ ...validItem, discountType: 'PERCENT', discountValue: 100 }).success,
    ).toBe(true)
  })

  it('allows an AMOUNT discount larger than 100 (only PERCENT is capped)', () => {
    expect(
      lineItemSchema.safeParse({ ...validItem, discountType: 'AMOUNT', discountValue: 99999 }).success,
    ).toBe(true)
  })
})

describe('documentFormSchema', () => {
  it('accepts a valid document with one item', () => {
    expect(documentFormSchema.safeParse(validDocument).success).toBe(true)
  })

  it('accepts a Draft with zero items', () => {
    expect(documentFormSchema.safeParse({ ...validDocument, items: [] }).success).toBe(true)
  })

  it('requires a customer to be selected', () => {
    expect(documentFormSchema.safeParse({ ...validDocument, customerId: '' }).success).toBe(false)
  })

  it('requires a valid documentType', () => {
    expect(documentFormSchema.safeParse({ ...validDocument, documentType: 'NOT_A_TYPE' }).success).toBe(
      false,
    )
  })

  it('requires issueDate', () => {
    expect(documentFormSchema.safeParse({ ...validDocument, issueDate: '' }).success).toBe(false)
  })

  it('rejects a document-level PERCENT discount over 100', () => {
    const result = documentFormSchema.safeParse({
      ...validDocument,
      documentDiscountType: 'PERCENT',
      documentDiscountValue: 150,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid nested line item', () => {
    const result = documentFormSchema.safeParse({
      ...validDocument,
      items: [{ ...validItem, quantity: -5 }],
    })
    expect(result.success).toBe(false)
  })
})
