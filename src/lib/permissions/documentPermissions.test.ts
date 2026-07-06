import { describe, expect, it } from 'vitest'
import { canApproveDocument, canEditDocument, canExportDocumentPdf, canMarkDocumentPaid } from './documentPermissions'
import type { DocumentStatus, DocumentType } from '@/types/document'
import type { MemberRole } from '@/types/member'

describe('canApproveDocument', () => {
  it.each<MemberRole>(['OWNER', 'ADMIN', 'ACCOUNTANT'])('allows %s to approve/mark paid/cancel', (role) => {
    expect(canApproveDocument(role)).toBe(true)
  })

  it('does not allow EDITOR to approve', () => {
    expect(canApproveDocument('EDITOR')).toBe(false)
  })

  it('does not allow VIEWER to approve', () => {
    expect(canApproveDocument('VIEWER')).toBe(false)
  })

  it('does not allow a user with no membership in the company', () => {
    expect(canApproveDocument(null)).toBe(false)
  })

  // Revision approval (Phase 4C) reuses this exact function — approving a
  // revision Draft is just approveDocument() on a row that happens to have
  // parent_document_id set, gated by the same "อนุมัติเอกสาร" button/check.
  it('does not allow EDITOR to approve a revision', () => {
    expect(canApproveDocument('EDITOR')).toBe(false)
  })
})

describe('canEditDocument', () => {
  it.each<MemberRole>(['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR'])('allows %s to create/edit a Draft', (role) => {
    expect(canEditDocument(role)).toBe(true)
  })

  it('does not allow VIEWER to edit', () => {
    expect(canEditDocument('VIEWER')).toBe(false)
  })

  it('does not allow a user with no membership in the company', () => {
    expect(canEditDocument(null)).toBe(false)
  })

  // "สร้าง Revision" (Phase 4C) and editing the resulting revision Draft
  // both reuse this exact function — a revision Draft is an ordinary Draft
  // row as far as permissions are concerned.
  it('does not allow VIEWER to create or edit a revision Draft', () => {
    expect(canEditDocument('VIEWER')).toBe(false)
  })
})

describe('canMarkDocumentPaid', () => {
  it.each<DocumentType>(['RECEIPT', 'RECEIPT_TAX_INVOICE'])(
    'allows an APPROVED %s to be marked paid by an approver',
    (documentType) => {
      expect(canMarkDocumentPaid(documentType, 'APPROVED', 'ACCOUNTANT')).toBe(true)
    },
  )

  it.each<DocumentType>(['RFQ', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'CREDIT_NOTE', 'CREDIT_NOTE_TAX'])(
    'never allows a %s to be marked paid, even when APPROVED and the user can approve',
    (documentType) => {
      expect(canMarkDocumentPaid(documentType, 'APPROVED', 'OWNER')).toBe(false)
    },
  )

  it('does not allow marking paid unless the document is APPROVED', () => {
    expect(canMarkDocumentPaid('RECEIPT', 'DRAFT', 'OWNER')).toBe(false)
    expect(canMarkDocumentPaid('RECEIPT', 'PAID', 'OWNER')).toBe(false)
    expect(canMarkDocumentPaid('RECEIPT', 'CANCELLED', 'OWNER')).toBe(false)
  })

  it('does not allow EDITOR or VIEWER to mark a receipt paid', () => {
    expect(canMarkDocumentPaid('RECEIPT', 'APPROVED', 'EDITOR')).toBe(false)
    expect(canMarkDocumentPaid('RECEIPT', 'APPROVED', 'VIEWER')).toBe(false)
  })

  it('does not allow a user with no membership in the company', () => {
    expect(canMarkDocumentPaid('RECEIPT', 'APPROVED', null)).toBe(false)
  })
})

describe('canExportDocumentPdf', () => {
  it('does not allow exporting a DRAFT (no document number yet, content can still change)', () => {
    expect(canExportDocumentPdf('DRAFT')).toBe(false)
  })

  it.each<DocumentStatus>(['APPROVED', 'PAID', 'CANCELLED'])(
    'allows exporting a %s document (already has a document number)',
    (status) => {
      expect(canExportDocumentPdf(status)).toBe(true)
    },
  )
})
