/**
 * Centralizes the display-text labels used across all 3 document
 * templates (customer/item-table/totals/date labels) into one defaults
 * object instead of scattering literal Thai strings through
 * DocumentPreview.tsx. Not yet wired to any company-level override
 * (Settings UI/DB) -- this pass only establishes the single source of
 * truth so per-company customization can be layered on top later
 * without touching every template's JSX again. Signature labels are
 * already independently configurable via SignatureSlot -- see
 * src/types/signature.ts -- and aren't duplicated here.
 */
export interface DocumentTemplateText {
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
