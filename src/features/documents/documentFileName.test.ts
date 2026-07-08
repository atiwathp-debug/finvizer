import { describe, expect, it } from 'vitest'
import { documentPdfFileName } from './documentFileName'
import type { DocumentRecord } from '@/types/document'

const document: DocumentRecord = {
  id: 'document-1',
  companyId: 'company-1',
  documentType: 'INVOICE',
  status: 'APPROVED',
  customerId: 'customer-1',
  customerCode: 'ORCHID',
  documentNumber: 'IV-2026-0001',
  vatMode: 'VAT_EXCLUDED',
  issueDate: '2026-07-03',
  dueDate: null,
  note: null,
  documentDiscountType: 'AMOUNT',
  documentDiscountValue: 0,
  subtotal: 1000,
  discountTotal: 0,
  vatAmount: 70,
  grandTotal: 1070,
  items: [],
  createdBy: 'user-1',
  approvedBy: 'user-1',
  approvedAt: '2026-07-03T00:00:00.000Z',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
  parentDocumentId: null,
  revisionNo: null,
  sourceDocumentId: null,
  installmentNumber: null,
  deletedAt: null,
  deletedBy: null,
}

describe('documentPdfFileName', () => {
  it('uses the document number when approved', () => {
    expect(documentPdfFileName(document, 'ใบแจ้งหนี้')).toBe('ใบแจ้งหนี้-IV-2026-0001.pdf')
  })

  it('falls back to DRAFT when there is no official number yet', () => {
    expect(documentPdfFileName({ ...document, documentNumber: null }, 'ใบแจ้งหนี้')).toBe('ใบแจ้งหนี้-DRAFT.pdf')
  })

  it('includes the revision-suffixed number for an approved revision', () => {
    expect(
      documentPdfFileName({ ...document, documentNumber: 'IV-2026-0001-R1', revisionNo: 1 }, 'ใบแจ้งหนี้'),
    ).toBe('ใบแจ้งหนี้-IV-2026-0001-R1.pdf')
  })
})
