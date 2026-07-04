export type DocumentStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'

export type DocumentType =
  | 'RFQ'
  | 'QUOTATION'
  | 'INVOICE'
  | 'TAX_INVOICE'
  | 'RECEIPT'
  | 'RECEIPT_TAX_INVOICE'
  | 'CREDIT_NOTE'
  | 'CREDIT_NOTE_TAX'

export type VatMode = 'NON_VAT' | 'VAT_EXCLUDED' | 'VAT_INCLUDED'
export type DiscountType = 'AMOUNT' | 'PERCENT'

export const vatModeLabels: Record<VatMode, string> = {
  NON_VAT: 'ไม่มีภาษีมูลค่าเพิ่ม',
  VAT_EXCLUDED: 'แยกภาษีมูลค่าเพิ่ม (Vat 7%)',
  VAT_INCLUDED: 'รวมภาษีมูลค่าเพิ่มแล้ว',
}

export const documentTypeLabels: Record<DocumentType, string> = {
  RFQ: 'ใบขอราคา',
  QUOTATION: 'ใบเสนอราคา',
  INVOICE: 'ใบแจ้งหนี้',
  TAX_INVOICE: 'ใบกำกับภาษี',
  RECEIPT: 'ใบเสร็จรับเงิน',
  RECEIPT_TAX_INVOICE: 'ใบเสร็จรับเงิน + ใบกำกับภาษี',
  CREDIT_NOTE: 'ใบลดหนี้',
  CREDIT_NOTE_TAX: 'ใบลดหนี้ + ภาษี',
}

export const documentStatusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  APPROVED: 'อนุมัติแล้ว',
  PAID: 'ชำระแล้ว',
  CANCELLED: 'ยกเลิก',
}

/** Short prefix used for the {DOC_TYPE} numbering token (Phase 2B) and document-number examples. */
export const documentTypeShortCode: Record<DocumentType, string> = {
  RFQ: 'RQ',
  QUOTATION: 'QO',
  INVOICE: 'IV',
  TAX_INVOICE: 'TI',
  RECEIPT: 'RE',
  RECEIPT_TAX_INVOICE: 'RTI',
  CREDIT_NOTE: 'CN',
  CREDIT_NOTE_TAX: 'CNT',
}

/**
 * The allowed document-conversion graph (Phase 6A) — a directed acyclic
 * graph, deliberately: every arrow points "further along" the natural
 * sales-to-collection lifecycle, and nothing ever points back to an
 * earlier stage, so a chain of conversions can never loop back on itself
 * (RFQ -> QUOTATION -> INVOICE -> RECEIPT -> RECEIPT_TAX_INVOICE ->
 * CREDIT_NOTE_TAX is the longest possible chain; CREDIT_NOTE and
 * CREDIT_NOTE_TAX are terminal). Kept in sync by hand with the identical
 * CASE-based check inside create_document_conversion() — see
 * supabase/migrations/20260712120000_document_conversion.sql.
 */
export const documentConversionMap: Record<DocumentType, DocumentType[]> = {
  RFQ: ['QUOTATION'],
  QUOTATION: ['INVOICE'],
  INVOICE: ['RECEIPT', 'TAX_INVOICE'],
  RECEIPT: ['RECEIPT_TAX_INVOICE'],
  RECEIPT_TAX_INVOICE: ['CREDIT_NOTE_TAX'],
  TAX_INVOICE: ['CREDIT_NOTE', 'CREDIT_NOTE_TAX'],
  CREDIT_NOTE: [],
  CREDIT_NOTE_TAX: [],
}

/** True if `to` is a valid conversion target for a document currently of type `from`. */
export function canConvertDocumentType(from: DocumentType, to: DocumentType): boolean {
  return documentConversionMap[from].includes(to)
}

/** A single line on a document — description/quantity/unit/price/discount, plus the computed `amount`. */
export interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string | null
  unitPrice: number
  discountType: DiscountType
  discountValue: number
  /** quantity × unitPrice, minus this item's own discount — see src/lib/calculations/documentTotals.ts. */
  amount: number
  sortOrder: number
}

/**
 * A real, persisted document row. Started minimal in Phase 2C (just what
 * backend-safe number generation needed); Phase 4A added the customer
 * link, VAT mode, dates, note, document-level discount, line items, and
 * the computed totals — everything a real Draft needs.
 */
export interface DocumentRecord {
  id: string
  companyId: string
  documentType: DocumentType
  status: DocumentStatus
  customerId: string | null
  customerCode: string | null
  /** Null while DRAFT — only ever set by the approval flow (Phase 4B), never editable directly. */
  documentNumber: string | null
  vatMode: VatMode
  issueDate: string
  dueDate: string | null
  note: string | null
  documentDiscountType: DiscountType
  documentDiscountValue: number
  /** Sum of item amounts, before the document-level discount. */
  subtotal: number
  /** The document-level discount actually applied. */
  discountTotal: number
  vatAmount: number
  grandTotal: number
  items: LineItem[]
  createdBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  /**
   * Set only on a revision — always the ORIGINAL document's id (Phase 4C).
   * Null for every ordinary document, including one that has revisions of
   * its own; revising a revision isn't supported (create_document_revision()
   * rejects it), so this never chains more than one level deep.
   */
  parentDocumentId: string | null
  /** Null until this revision is approved; then 1, 2, 3... in approval order among the same parent's revisions. */
  revisionNo: number | null
  /**
   * Set only on a document created via "แปลงเอกสาร" (Phase 6A) — the
   * document it was converted FROM (a different documentType, e.g. an
   * INVOICE converted to a RECEIPT). Independent of parentDocumentId:
   * conversion and revision are separate lineages that never interact —
   * a document can be both a revision AND a conversion target, or
   * neither, or either alone.
   */
  sourceDocumentId: string | null
  /**
   * Set only when this Draft was pre-filled from picking a specific
   * installment during "แปลงเอกสาร" (production readiness pass 2,
   * assisted single-step). Purely a display/pre-fill hint — never read by
   * mark_document_paid() or create_document_conversion(). Null for every
   * ordinary document.
   */
  installmentNumber: number | null
}

/** "R1"/"R2"/... for a revision's revisionNo, or null if not (yet) an approved revision. */
export function revisionLabel(revisionNo: number | null): string | null {
  return revisionNo === null ? null : `R${revisionNo}`
}
