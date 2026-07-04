export type InstallmentAmountType = 'PERCENT' | 'FIXED'

/**
 * One row of a document's installment payment plan (production readiness
 * pass 2) — see supabase/migrations/20260717120000_document_installments.sql.
 * Only meaningful while the parent document is still DRAFT (same lifecycle
 * as document_items); frozen once approved.
 */
export interface DocumentInstallment {
  id: string
  documentId: string
  installmentNo: number
  amountType: InstallmentAmountType
  /** Raw input value — a percent (0-100) if amountType = PERCENT, or a baht amount if FIXED. */
  amountValue: number
  /** Computed baht amount at save time — snapshotted the same way document_items.amount is, never recomputed by the DB. */
  computedAmount: number
  dueDate: string | null
  note: string | null
  sortOrder: number
}

export const installmentAmountTypeLabels: Record<InstallmentAmountType, string> = {
  PERCENT: 'เปอร์เซ็นต์ (%)',
  FIXED: 'จำนวนเงิน (บาท)',
}

/**
 * Hand-off shape for the "assisted single-step" installment-aware
 * conversion flow (production readiness pass 2, Stage 5) — passed as
 * router state (never a query param, never persisted) from
 * DocumentDetailPage's convert dialog to the freshly-created Draft's edit
 * route. Purely a client-side pre-fill hint: createDocumentConversion/
 * create_document_conversion is called with zero new arguments and always
 * copies the source's full amount unchanged, exactly as before this
 * feature existed.
 */
export interface ConversionInstallmentPick {
  installmentNumber: number
  computedAmount: number
  note: string | null
}
