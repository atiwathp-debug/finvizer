import { describe, expect, it } from 'vitest'
import {
  defaultDashboardDateRange,
  filterDocumentsByDateRange,
  groupDocumentsByStatus,
  invoicedSalesTotal,
  invoicedVsPaidMonthly,
  outstandingInvoiceTotal,
  paidSalesTotal,
  pendingApprovalCount,
  pendingApprovalDocuments,
  topCustomersByAmount,
  topCustomersByFrequency,
  trackQuotationStatuses,
} from './documentReports'
import type { DocumentRecord } from '@/types/document'

let idCounter = 0

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  idCounter += 1
  return {
    id: `doc-${idCounter}`,
    companyId: 'company-1',
    documentType: 'INVOICE',
    status: 'DRAFT',
    customerId: null,
    customerCode: null,
    documentNumber: null,
    vatMode: 'VAT_EXCLUDED',
    issueDate: '2026-07-01',
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
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    parentDocumentId: null,
    revisionNo: null,
    sourceDocumentId: null,
    installmentNumber: null,
    ...overrides,
  }
}

describe('groupDocumentsByStatus', () => {
  it('counts documents by status correctly, including zero for missing statuses', () => {
    const documents = [
      makeDocument({ status: 'DRAFT' }),
      makeDocument({ status: 'DRAFT' }),
      makeDocument({ status: 'APPROVED' }),
      makeDocument({ status: 'PAID' }),
    ]

    expect(groupDocumentsByStatus(documents)).toEqual({
      DRAFT: 2,
      APPROVED: 1,
      PAID: 1,
      CANCELLED: 0,
    })
  })

  it('returns all-zero counts for an empty list', () => {
    expect(groupDocumentsByStatus([])).toEqual({ DRAFT: 0, APPROVED: 0, PAID: 0, CANCELLED: 0 })
  })
})

describe('filterDocumentsByDateRange', () => {
  it('keeps only documents whose issueDate falls within the range, inclusive', () => {
    const documents = [
      makeDocument({ issueDate: '2026-06-30' }),
      makeDocument({ issueDate: '2026-07-01' }),
      makeDocument({ issueDate: '2026-07-15' }),
      makeDocument({ issueDate: '2026-07-31' }),
      makeDocument({ issueDate: '2026-08-01' }),
    ]

    const result = filterDocumentsByDateRange(documents, '2026-07-01', '2026-07-31')

    expect(result.map((d) => d.issueDate)).toEqual(['2026-07-01', '2026-07-15', '2026-07-31'])
  })
})

describe('defaultDashboardDateRange', () => {
  it('returns today back 3 calendar months', () => {
    const result = defaultDashboardDateRange(new Date('2026-07-15T00:00:00.000Z'))
    expect(result).toEqual({ start: '2026-04-15', end: '2026-07-15' })
  })
})

describe('pendingApprovalCount', () => {
  it('counts only DRAFT documents', () => {
    const documents = [
      makeDocument({ status: 'DRAFT' }),
      makeDocument({ status: 'DRAFT' }),
      makeDocument({ status: 'APPROVED' }),
      makeDocument({ status: 'PAID' }),
    ]
    expect(pendingApprovalCount(documents)).toBe(2)
  })
})

describe('pendingApprovalDocuments', () => {
  it('returns only DRAFT documents, newest createdAt first', () => {
    const oldest = makeDocument({ status: 'DRAFT', createdAt: '2026-01-01T00:00:00.000Z' })
    const middle = makeDocument({ status: 'DRAFT', createdAt: '2026-02-01T00:00:00.000Z' })
    const newest = makeDocument({ status: 'DRAFT', createdAt: '2026-03-01T00:00:00.000Z' })
    const approved = makeDocument({ status: 'APPROVED', createdAt: '2026-04-01T00:00:00.000Z' })

    const result = pendingApprovalDocuments([oldest, approved, middle, newest])

    expect(result.map((d) => d.id)).toEqual([newest.id, middle.id, oldest.id])
  })

  it('caps the result at `limit`, defaulting to 5', () => {
    const drafts = Array.from({ length: 8 }, (_, i) =>
      makeDocument({ status: 'DRAFT', createdAt: `2026-01-0${i + 1}T00:00:00.000Z` }),
    )

    expect(pendingApprovalDocuments(drafts)).toHaveLength(5)
    expect(pendingApprovalDocuments(drafts, 3)).toHaveLength(3)
  })

  it('returns an empty array when there are no DRAFT documents', () => {
    expect(pendingApprovalDocuments([makeDocument({ status: 'APPROVED' })])).toEqual([])
  })
})

describe('invoicedSalesTotal / paidSalesTotal / outstandingInvoiceTotal', () => {
  it('are computed from INVOICE documents only, and invoiced = outstanding + paid', () => {
    const documents = [
      makeDocument({ documentType: 'INVOICE', status: 'APPROVED', grandTotal: 500 }),
      makeDocument({ documentType: 'INVOICE', status: 'PAID', grandTotal: 300 }),
      makeDocument({ documentType: 'INVOICE', status: 'DRAFT', grandTotal: 9999 }),
      makeDocument({ documentType: 'INVOICE', status: 'CANCELLED', grandTotal: 9999 }),
      // Non-INVOICE documents must never contribute, even if PAID/APPROVED.
      makeDocument({ documentType: 'RECEIPT', status: 'PAID', grandTotal: 9999 }),
      makeDocument({ documentType: 'QUOTATION', status: 'APPROVED', grandTotal: 9999 }),
    ]

    expect(invoicedSalesTotal(documents)).toBe(800)
    expect(paidSalesTotal(documents)).toBe(300)
    expect(outstandingInvoiceTotal(documents)).toBe(500)
    expect(outstandingInvoiceTotal(documents) + paidSalesTotal(documents)).toBe(invoicedSalesTotal(documents))
  })

  it('returns zero for an empty document list', () => {
    expect(invoicedSalesTotal([])).toBe(0)
    expect(paidSalesTotal([])).toBe(0)
    expect(outstandingInvoiceTotal([])).toBe(0)
  })
})

describe('invoicedVsPaidMonthly', () => {
  it('buckets INVOICE totals by issue month, separating invoiced (APPROVED+PAID) from paid (PAID only)', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')
    const documents = [
      makeDocument({ documentType: 'INVOICE', status: 'PAID', issueDate: '2026-07-05', grandTotal: 500 }),
      makeDocument({ documentType: 'INVOICE', status: 'APPROVED', issueDate: '2026-07-20', grandTotal: 300 }),
      makeDocument({ documentType: 'INVOICE', status: 'PAID', issueDate: '2026-06-10', grandTotal: 200 }),
      makeDocument({ documentType: 'INVOICE', status: 'DRAFT', issueDate: '2026-07-10', grandTotal: 9999 }),
      makeDocument({ documentType: 'RECEIPT', status: 'PAID', issueDate: '2026-07-10', grandTotal: 9999 }),
    ]

    const result = invoicedVsPaidMonthly(documents, 3, now)

    expect(result).toHaveLength(3)
    expect(result[result.length - 1].key).toBe('2026-07')
    expect(result[result.length - 1].invoiced).toBe(800) // 500 + 300
    expect(result[result.length - 1].paid).toBe(500)
    expect(result[result.length - 2].key).toBe('2026-06')
    expect(result[result.length - 2].invoiced).toBe(200)
    expect(result[result.length - 2].paid).toBe(200)
  })

  it('returns exactly monthsBack buckets even with no documents at all', () => {
    const result = invoicedVsPaidMonthly([], 6, new Date('2026-07-15T00:00:00.000Z'))
    expect(result).toHaveLength(6)
    expect(result.every((bucket) => bucket.invoiced === 0 && bucket.paid === 0)).toBe(true)
  })
})

describe('topCustomersByAmount / topCustomersByFrequency', () => {
  it('sums/counts INVOICE documents (APPROVED/PAID only) per customer, sorted appropriately', () => {
    const documents = [
      makeDocument({ documentType: 'INVOICE', customerId: 'cust-a', status: 'PAID', grandTotal: 500 }),
      makeDocument({ documentType: 'INVOICE', customerId: 'cust-a', status: 'APPROVED', grandTotal: 300 }),
      makeDocument({ documentType: 'INVOICE', customerId: 'cust-b', status: 'PAID', grandTotal: 1200 }),
      makeDocument({ documentType: 'INVOICE', customerId: 'cust-a', status: 'DRAFT', grandTotal: 9999 }),
      makeDocument({ documentType: 'INVOICE', customerId: null, status: 'PAID', grandTotal: 9999 }),
      makeDocument({ documentType: 'RECEIPT', customerId: 'cust-b', status: 'PAID', grandTotal: 9999 }),
    ]

    expect(topCustomersByAmount(documents)).toEqual([
      { customerId: 'cust-b', total: 1200, documentCount: 1 },
      { customerId: 'cust-a', total: 800, documentCount: 2 },
    ])
    expect(topCustomersByFrequency(documents)).toEqual([
      { customerId: 'cust-a', total: 800, documentCount: 2 },
      { customerId: 'cust-b', total: 1200, documentCount: 1 },
    ])
  })

  it('respects the limit parameter', () => {
    const documents = [
      makeDocument({ documentType: 'INVOICE', customerId: 'a', status: 'PAID', grandTotal: 100 }),
      makeDocument({ documentType: 'INVOICE', customerId: 'b', status: 'PAID', grandTotal: 200 }),
      makeDocument({ documentType: 'INVOICE', customerId: 'c', status: 'PAID', grandTotal: 300 }),
    ]

    expect(topCustomersByAmount(documents, 2)).toHaveLength(2)
    expect(topCustomersByFrequency(documents, 2)).toHaveLength(2)
  })
})

describe('trackQuotationStatuses', () => {
  it('maps DRAFT/CANCELLED quotations directly from their own status', () => {
    const draft = makeDocument({ documentType: 'QUOTATION', status: 'DRAFT' })
    const cancelled = makeDocument({ documentType: 'QUOTATION', status: 'CANCELLED' })

    const result = trackQuotationStatuses([draft, cancelled], [draft, cancelled])

    expect(result).toEqual([
      { document: draft, trackingStatus: 'DRAFT' },
      { document: cancelled, trackingStatus: 'CANCELLED' },
    ])
  })

  it('reports APPROVED when there is no downstream invoice yet', () => {
    const quotation = makeDocument({ documentType: 'QUOTATION', status: 'APPROVED' })
    const result = trackQuotationStatuses([quotation], [quotation])
    expect(result).toEqual([{ document: quotation, trackingStatus: 'APPROVED' }])
  })

  it('reports CONVERTED_TO_INVOICE when the downstream invoice is APPROVED but not yet paid', () => {
    const quotation = makeDocument({ documentType: 'QUOTATION', status: 'APPROVED' })
    const invoice = makeDocument({ documentType: 'INVOICE', status: 'APPROVED', sourceDocumentId: quotation.id })

    const result = trackQuotationStatuses([quotation, invoice], [quotation])

    expect(result).toEqual([{ document: quotation, trackingStatus: 'CONVERTED_TO_INVOICE' }])
  })

  it('reports PAID when the downstream invoice has been paid, even across a multi-hop chain', () => {
    const quotation = makeDocument({ documentType: 'QUOTATION', status: 'APPROVED' })
    const invoice = makeDocument({ documentType: 'INVOICE', status: 'PAID', sourceDocumentId: quotation.id })
    const receipt = makeDocument({ documentType: 'RECEIPT', status: 'PAID', sourceDocumentId: invoice.id })

    const result = trackQuotationStatuses([quotation, invoice, receipt], [quotation])

    expect(result).toEqual([{ document: quotation, trackingStatus: 'PAID' }])
  })

  it('resolves against the full document set even when the invoice falls outside the visible range', () => {
    const quotation = makeDocument({ documentType: 'QUOTATION', status: 'APPROVED', issueDate: '2026-01-01' })
    const invoice = makeDocument({
      documentType: 'INVOICE',
      status: 'PAID',
      issueDate: '2026-07-01',
      sourceDocumentId: quotation.id,
    })

    // quotationsInRange includes the quotation, but the full set (allDocuments) also has the invoice.
    const result = trackQuotationStatuses([quotation, invoice], [quotation])

    expect(result).toEqual([{ document: quotation, trackingStatus: 'PAID' }])
  })
})
