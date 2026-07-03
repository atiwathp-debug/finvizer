import { describe, expect, it } from 'vitest'
import {
  calculateDocumentTotals,
  calculateLineItemAmount,
  type LineItemMoneyInput,
} from './documentTotals'

const noDiscount = (quantity: number, unitPrice: number): LineItemMoneyInput => ({
  quantity,
  unitPrice,
  discountType: 'AMOUNT',
  discountValue: 0,
})

describe('calculateLineItemAmount', () => {
  it('multiplies quantity by unit price with no discount', () => {
    expect(calculateLineItemAmount(noDiscount(2, 100))).toBe(200)
  })

  it('applies an item-level AMOUNT discount', () => {
    expect(
      calculateLineItemAmount({ quantity: 1, unitPrice: 1000, discountType: 'AMOUNT', discountValue: 100 }),
    ).toBe(900)
  })

  it('applies an item-level PERCENT discount', () => {
    expect(
      calculateLineItemAmount({ quantity: 1, unitPrice: 1000, discountType: 'PERCENT', discountValue: 10 }),
    ).toBe(900)
  })

  it('clamps a discount larger than the gross amount to zero, never negative', () => {
    expect(
      calculateLineItemAmount({ quantity: 1, unitPrice: 100, discountType: 'AMOUNT', discountValue: 500 }),
    ).toBe(0)
  })

  it('handles a fractional quantity without floating-point drift', () => {
    // 1.5 * 33.33 = 49.995 — resolved deterministically via integer satang math.
    expect(calculateLineItemAmount(noDiscount(1.5, 33.33))).toBe(50)
  })

  it('handles many repeated additions without accumulating float error', () => {
    // The classic 0.1 + 0.2 style trap: 3 units at 0.1 each should be exactly 0.3, not 0.30000000000000004.
    expect(calculateLineItemAmount(noDiscount(3, 0.1))).toBe(0.3)
  })
})

describe('calculateDocumentTotals — VAT modes', () => {
  it('VAT_EXCLUDED adds 7% on top of the net amount', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(2, 100)],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      vatMode: 'VAT_EXCLUDED',
    })
    expect(result.subtotal).toBe(200)
    expect(result.vatAmount).toBe(14)
    expect(result.grandTotal).toBe(214)
  })

  it('VAT_INCLUDED extracts VAT from within the net amount, grand total unchanged', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(2, 100)],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      vatMode: 'VAT_INCLUDED',
    })
    expect(result.subtotal).toBe(200)
    expect(result.vatAmount).toBe(13.08)
    expect(result.grandTotal).toBe(200)
  })

  it('NON_VAT charges no VAT at all', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(2, 100)],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      vatMode: 'NON_VAT',
    })
    expect(result.vatAmount).toBe(0)
    expect(result.grandTotal).toBe(200)
  })
})

describe('calculateDocumentTotals — document-level discount', () => {
  it('applies a PERCENT document discount after summing items', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(1, 500), noDiscount(1, 500)],
      documentDiscountType: 'PERCENT',
      documentDiscountValue: 10,
      vatMode: 'VAT_EXCLUDED',
    })
    expect(result.subtotal).toBe(1000)
    expect(result.discountTotal).toBe(100)
    // net after discount = 900, VAT = 63, grand total = 963
    expect(result.vatAmount).toBe(63)
    expect(result.grandTotal).toBe(963)
  })

  it('applies an AMOUNT document discount after summing items', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(1, 500), noDiscount(1, 500)],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 250,
      vatMode: 'NON_VAT',
    })
    expect(result.subtotal).toBe(1000)
    expect(result.discountTotal).toBe(250)
    expect(result.grandTotal).toBe(750)
  })

  it('clamps a document discount larger than the subtotal to zero net, never negative', () => {
    const result = calculateDocumentTotals({
      items: [noDiscount(1, 100)],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 500,
      vatMode: 'NON_VAT',
    })
    expect(result.discountTotal).toBe(100)
    expect(result.grandTotal).toBe(0)
  })
})

describe('calculateDocumentTotals — multiple items', () => {
  it('sums several items with mixed discounts correctly', () => {
    const result = calculateDocumentTotals({
      items: [
        { quantity: 2, unitPrice: 150, discountType: 'AMOUNT', discountValue: 0 }, // 300
        { quantity: 1, unitPrice: 1000, discountType: 'PERCENT', discountValue: 15 }, // 850
        { quantity: 3, unitPrice: 99.5, discountType: 'AMOUNT', discountValue: 10 }, // 298.5 - 10 = 288.5
      ],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      vatMode: 'NON_VAT',
    })
    expect(result.itemAmounts).toEqual([300, 850, 288.5])
    expect(result.subtotal).toBe(1438.5)
    expect(result.grandTotal).toBe(1438.5)
  })

  it('returns a zero subtotal/grand total for no items', () => {
    const result = calculateDocumentTotals({
      items: [],
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      vatMode: 'VAT_EXCLUDED',
    })
    expect(result.subtotal).toBe(0)
    expect(result.vatAmount).toBe(0)
    expect(result.grandTotal).toBe(0)
  })
})
