export type DiscountType = 'AMOUNT' | 'PERCENT'
export type VatMode = 'NON_VAT' | 'VAT_EXCLUDED' | 'VAT_INCLUDED'
export type InstallmentAmountType = 'PERCENT' | 'FIXED'

/** Thailand's standard VAT rate. */
export const VAT_RATE = 0.07

export interface LineItemMoneyInput {
  quantity: number
  unitPrice: number
  discountType: DiscountType
  discountValue: number
}

export interface DocumentTotalsInput {
  items: LineItemMoneyInput[]
  documentDiscountType: DiscountType
  documentDiscountValue: number
  vatMode: VatMode
}

export interface DocumentTotalsResult {
  /** Baht, 2 decimals, parallel to `items` in the input. */
  itemAmounts: number[]
  subtotal: number
  /** The document-level discount actually applied (clamped so it can never exceed subtotal). */
  discountTotal: number
  vatAmount: number
  grandTotal: number
}

/**
 * All money math happens in integer satang (1 baht = 100 satang) so no
 * step ever accumulates floating-point drift — baht values only exist at
 * the input and output boundaries. This is the "integer cents" approach
 * (Thailand's cent-equivalent is the satang) rather than a big-decimal
 * library, since every value here already fits comfortably within JS's
 * safe integer range.
 */
function toSatang(baht: number): number {
  return Math.round(baht * 100)
}

function fromSatang(satang: number): number {
  return Math.round(satang) / 100
}

function calculateDiscountSatang(baseSatang: number, discountType: DiscountType, discountValue: number): number {
  if (discountType === 'PERCENT') {
    return Math.round((baseSatang * discountValue) / 100)
  }
  return toSatang(discountValue)
}

/** A single line item's amount (quantity × unitPrice, minus its own discount) — rounded to 2 decimals, never negative. */
export function calculateLineItemAmount(input: LineItemMoneyInput): number {
  // Quantity gets its own 2-decimal fixed-point scale (centi-units) so
  // fractional quantities like 1.5 hours don't need floating multiplication.
  const quantityCenti = Math.round(input.quantity * 100)
  const unitPriceSatang = toSatang(input.unitPrice)
  const grossSatang = Math.round((quantityCenti * unitPriceSatang) / 100)
  const discountSatang = calculateDiscountSatang(grossSatang, input.discountType, input.discountValue)
  const amountSatang = Math.max(0, grossSatang - discountSatang)
  return fromSatang(amountSatang)
}

/**
 * Subtotal (sum of item amounts) → document-level discount → VAT (per
 * vatMode) → grand total. Shared by DocumentForm's live preview, the
 * mock data layer, and (mirrored, since Postgres can't import this file)
 * the real data layer's pre-save calculation — see
 * src/lib/supabase/documents.ts.
 */
export function calculateDocumentTotals(input: DocumentTotalsInput): DocumentTotalsResult {
  const itemAmountsSatang = input.items.map((item) => toSatang(calculateLineItemAmount(item)))
  const subtotalSatang = itemAmountsSatang.reduce((sum, amount) => sum + amount, 0)

  const documentDiscountSatang = Math.min(
    subtotalSatang,
    calculateDiscountSatang(subtotalSatang, input.documentDiscountType, input.documentDiscountValue),
  )
  const netAfterDiscountSatang = subtotalSatang - documentDiscountSatang

  let vatAmountSatang = 0
  let grandTotalSatang = netAfterDiscountSatang

  if (input.vatMode === 'VAT_EXCLUDED') {
    vatAmountSatang = Math.round(netAfterDiscountSatang * VAT_RATE)
    grandTotalSatang = netAfterDiscountSatang + vatAmountSatang
  } else if (input.vatMode === 'VAT_INCLUDED') {
    const baseSatang = Math.round(netAfterDiscountSatang / (1 + VAT_RATE))
    vatAmountSatang = netAfterDiscountSatang - baseSatang
    // grandTotalSatang stays netAfterDiscountSatang — VAT was already included.
  }
  // NON_VAT: vatAmountSatang stays 0, grandTotalSatang stays netAfterDiscountSatang.

  return {
    itemAmounts: itemAmountsSatang.map(fromSatang),
    subtotal: fromSatang(subtotalSatang),
    discountTotal: fromSatang(documentDiscountSatang),
    vatAmount: fromSatang(vatAmountSatang),
    grandTotal: fromSatang(grandTotalSatang),
  }
}

/** One installment row's baht amount — a percent of grandTotal, or a fixed baht value, satang-precise like calculateDiscountSatang. */
export function calculateInstallmentAmount(
  amountType: InstallmentAmountType,
  amountValue: number,
  grandTotal: number,
): number {
  if (amountType === 'PERCENT') {
    return fromSatang(Math.round((toSatang(grandTotal) * amountValue) / 100))
  }
  return fromSatang(toSatang(amountValue))
}

export interface InstallmentSumCheck {
  totalComputed: number
  /** True if the installments' combined amount exceeds the document's grand total — a plan may legitimately total less (e.g. a deposit-only plan), but never more. */
  exceedsGrandTotal: boolean
}

export function validateInstallmentSum(
  installments: Array<{ amountType: InstallmentAmountType; amountValue: number }>,
  grandTotal: number,
): InstallmentSumCheck {
  const totalComputed = installments.reduce(
    (sum, installment) => sum + calculateInstallmentAmount(installment.amountType, installment.amountValue, grandTotal),
    0,
  )
  // Small epsilon to absorb satang-rounding noise across multiple rows, not a business tolerance.
  return { totalComputed, exceedsGrandTotal: totalComputed > grandTotal + 0.005 }
}
