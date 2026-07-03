import { describe, expect, it } from 'vitest'
import {
  computeDashboardStats,
  customerTotals,
  groupDocumentsByStatus,
  monthlyTotals,
  recentDocuments,
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

describe('computeDashboardStats', () => {
  it('counts real/mock documents correctly across every status', () => {
    const documents = [
      makeDocument({ status: 'DRAFT', grandTotal: 100 }),
      makeDocument({ status: 'APPROVED', grandTotal: 500 }),
      makeDocument({ status: 'APPROVED', grandTotal: 300 }),
      makeDocument({ status: 'PAID', grandTotal: 1000 }),
      makeDocument({ status: 'CANCELLED', grandTotal: 200 }),
    ]

    const stats = computeDashboardStats(documents)

    expect(stats.totalDocuments).toBe(5)
    expect(stats.draftCount).toBe(1)
    expect(stats.approvedCount).toBe(2)
    expect(stats.paidCount).toBe(1)
    expect(stats.cancelledCount).toBe(1)
    expect(stats.totalRevenue).toBe(1000) // PAID only
    expect(stats.outstandingAmount).toBe(800) // APPROVED only (500 + 300)
  })

  it('returns all zeros for an empty document list', () => {
    const stats = computeDashboardStats([])
    expect(stats).toEqual({
      totalDocuments: 0,
      draftCount: 0,
      approvedCount: 0,
      paidCount: 0,
      cancelledCount: 0,
      totalRevenue: 0,
      outstandingAmount: 0,
    })
  })
})

describe('monthlyTotals', () => {
  it('buckets APPROVED/PAID documents by issue month and excludes Draft/Cancelled', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')
    const documents = [
      makeDocument({ status: 'PAID', issueDate: '2026-07-05', grandTotal: 500 }),
      makeDocument({ status: 'APPROVED', issueDate: '2026-07-20', grandTotal: 300 }),
      makeDocument({ status: 'PAID', issueDate: '2026-06-10', grandTotal: 200 }),
      makeDocument({ status: 'DRAFT', issueDate: '2026-07-10', grandTotal: 9999 }),
      makeDocument({ status: 'CANCELLED', issueDate: '2026-07-10', grandTotal: 9999 }),
    ]

    const result = monthlyTotals(documents, 3, now)

    expect(result).toHaveLength(3)
    expect(result[result.length - 1].key).toBe('2026-07')
    expect(result[result.length - 1].total).toBe(800) // 500 + 300
    expect(result[result.length - 2].key).toBe('2026-06')
    expect(result[result.length - 2].total).toBe(200)
  })

  it('returns exactly monthsBack buckets even with no documents at all', () => {
    const result = monthlyTotals([], 6, new Date('2026-07-15T00:00:00.000Z'))
    expect(result).toHaveLength(6)
    expect(result.every((bucket) => bucket.total === 0)).toBe(true)
  })
})

describe('customerTotals', () => {
  it('sums grandTotal per customer (APPROVED/PAID only) and sorts highest first', () => {
    const documents = [
      makeDocument({ customerId: 'cust-a', status: 'PAID', grandTotal: 500 }),
      makeDocument({ customerId: 'cust-a', status: 'APPROVED', grandTotal: 300 }),
      makeDocument({ customerId: 'cust-b', status: 'PAID', grandTotal: 1200 }),
      makeDocument({ customerId: 'cust-a', status: 'DRAFT', grandTotal: 9999 }),
      makeDocument({ customerId: null, status: 'PAID', grandTotal: 9999 }),
    ]

    const result = customerTotals(documents)

    expect(result).toEqual([
      { customerId: 'cust-b', total: 1200, documentCount: 1 },
      { customerId: 'cust-a', total: 800, documentCount: 2 },
    ])
  })

  it('respects the limit parameter', () => {
    const documents = [
      makeDocument({ customerId: 'a', status: 'PAID', grandTotal: 100 }),
      makeDocument({ customerId: 'b', status: 'PAID', grandTotal: 200 }),
      makeDocument({ customerId: 'c', status: 'PAID', grandTotal: 300 }),
    ]

    expect(customerTotals(documents, 2)).toHaveLength(2)
  })
})

describe('recentDocuments', () => {
  it('returns the most recently created documents first, capped at the limit', () => {
    const documents = [
      makeDocument({ createdAt: '2026-07-01T00:00:00.000Z' }),
      makeDocument({ createdAt: '2026-07-03T00:00:00.000Z' }),
      makeDocument({ createdAt: '2026-07-02T00:00:00.000Z' }),
    ]

    const result = recentDocuments(documents, 2)

    expect(result).toHaveLength(2)
    expect(result[0].createdAt).toBe('2026-07-03T00:00:00.000Z')
    expect(result[1].createdAt).toBe('2026-07-02T00:00:00.000Z')
  })
})
