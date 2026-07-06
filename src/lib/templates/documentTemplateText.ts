import { documentTypeLabels, type DocumentType } from '@/types/document'

/**
 * Centralizes the display-text labels used across all 3 document
 * templates (customer/item-table/totals/date labels) into one defaults
 * object instead of scattering literal Thai strings through
 * DocumentPreview.tsx. Signature labels are already independently
 * configurable via SignatureSlot -- see src/types/signature.ts -- and
 * aren't duplicated here.
 */
// `type`, not `interface` — this shape ends up serialized into the
// companies.template_text_overrides jsonb column, and interfaces don't
// get the implicit index signature structural checks against `Json`
// need (see CompanyRow's comment in src/types/database.ts for the same
// issue previously bisected against postgrest-js).
export type DocumentTemplateText = {
  customerLabel: string
  itemDescriptionLabel: string
  itemQuantityLabel: string
  itemUnitPriceLabel: string
  itemAmountLabel: string
  subtotalLabel: string
  discountLabel: string
  vatLabel: string
  grandTotalLabel: string
  issueDateLabel: string
  dueDateLabel: string
  documentNumberLabel: string
  pendingDocumentNumberLabel: string
  noteLabel: string
  noItemsLabel: string
  installmentSectionLabel: string
  installmentNoLabel: string
  installmentDetailLabel: string
}

export const DEFAULT_DOCUMENT_TEMPLATE_TEXT: DocumentTemplateText = {
  customerLabel: 'ลูกค้า',
  itemDescriptionLabel: 'รายการ',
  itemQuantityLabel: 'จำนวน',
  itemUnitPriceLabel: 'ราคา/หน่วย',
  itemAmountLabel: 'จำนวนเงิน',
  subtotalLabel: 'รวมเป็นเงิน',
  discountLabel: 'ส่วนลด',
  vatLabel: 'ภาษีมูลค่าเพิ่ม',
  grandTotalLabel: 'ยอดรวมทั้งสิ้น',
  issueDateLabel: 'วันที่ออกเอกสาร',
  dueDateLabel: 'ครบกำหนด',
  documentNumberLabel: 'เลขที่เอกสาร',
  pendingDocumentNumberLabel: 'จะออกเลขเมื่ออนุมัติ',
  noteLabel: 'หมายเหตุ',
  noItemsLabel: 'ยังไม่มีรายการ',
  installmentSectionLabel: 'เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)',
  installmentNoLabel: 'งวดที่',
  installmentDetailLabel: 'รายละเอียด',
}

/**
 * Pass 4: a company's saved customizations, stored verbatim in
 * companies.template_text_overrides (jsonb, default '{}'). Every key is
 * optional -- an absent/blank value always falls back to the Thai default
 * above, so a fresh company (or one that's only customized a couple of
 * labels) never shows a blank label on a real document. `labels` covers
 * the DocumentTemplateText fields the Settings UI currently exposes
 * (customer/table/totals/VAT/date/note); `documentTypeTitles` covers the
 * printed document title (ใบเสนอราคา/ใบแจ้งหนี้/etc.), which lives in a
 * separate map (documentTypeLabels, src/types/document.ts) since it's
 * keyed by DocumentType rather than being a single fixed label.
 */
export type DocumentTemplateTextOverrides = {
  labels?: Partial<DocumentTemplateText>
  documentTypeTitles?: Partial<Record<DocumentType, string>>
}

export const EMPTY_TEMPLATE_TEXT_OVERRIDES: DocumentTemplateTextOverrides = {}

/** Trimmed non-empty override value, or undefined to signal "use the default" -- shared by both resolvers below. */
function overrideOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Merges a company's saved overrides onto the Thai defaults -- what every template actually renders. */
export function resolveDocumentTemplateText(
  overrides?: DocumentTemplateTextOverrides | null,
): DocumentTemplateText {
  const labels = overrides?.labels
  if (!labels) return DEFAULT_DOCUMENT_TEMPLATE_TEXT

  const resolved = { ...DEFAULT_DOCUMENT_TEMPLATE_TEXT }
  for (const key of Object.keys(DEFAULT_DOCUMENT_TEMPLATE_TEXT) as (keyof DocumentTemplateText)[]) {
    const override = overrideOrUndefined(labels[key])
    if (override) resolved[key] = override
  }
  return resolved
}

/** Same fallback rule as resolveDocumentTemplateText, but for the per-document-type printed title. */
export function resolveDocumentTypeLabel(
  type: DocumentType,
  overrides?: DocumentTemplateTextOverrides | null,
): string {
  return overrideOrUndefined(overrides?.documentTypeTitles?.[type]) ?? documentTypeLabels[type]
}
