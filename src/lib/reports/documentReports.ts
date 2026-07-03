import type { DocumentRecord, DocumentStatus } from '@/types/document'

/** Counts of each document status. */
export function groupDocumentsByStatus(documents: DocumentRecord[]): Record<DocumentStatus, number> {
  const counts: Record<DocumentStatus, number> = { DRAFT: 0, APPROVED: 0, PAID: 0, CANCELLED: 0 }
  for (const doc of documents) counts[doc.status]++
  return counts
}

/** Filters documents whose issueDate falls within [startISO, endISO], inclusive. */
export function filterDocumentsByDateRange(
  documents: DocumentRecord[],
  startISO: string,
  endISO: string,
): DocumentRecord[] {
  return documents.filter((doc) => doc.issueDate >= startISO && doc.issueDate <= endISO)
}

/**
 * "YYYY-MM-DD" for `now` and for exactly 3 calendar months before `now` —
 * the dashboard's default date range. Computed entirely in UTC so `start`
 * and `end` stay consistent regardless of the runtime's local timezone
 * (mixing local getFullYear()/getMonth() with a UTC toISOString() could
 * otherwise shift `start` by a day near local midnight).
 */
export function defaultDashboardDateRange(now: Date = new Date()): { start: string; end: string } {
  const end = now.toISOString().slice(0, 10)
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()))
  const start = startDate.toISOString().slice(0, 10)
  return { start, end }
}

/** Documents awaiting approval — "จำนวนเอกสารที่รอการอนุมัติ". */
export function pendingApprovalCount(documents: DocumentRecord[]): number {
  return documents.filter((d) => d.status === 'DRAFT').length
}

/** Sum of grandTotal across INVOICE documents that have been issued (APPROVED or PAID) — "ยอดขายที่ออกใบแจ้งหนี้". */
export function invoicedSalesTotal(documents: DocumentRecord[]): number {
  return documents
    .filter((d) => d.documentType === 'INVOICE' && (d.status === 'APPROVED' || d.status === 'PAID'))
    .reduce((sum, d) => sum + d.grandTotal, 0)
}

/** Sum of grandTotal across INVOICE documents already paid — "ยอดขายที่มีการชำระเงินแล้ว". */
export function paidSalesTotal(documents: DocumentRecord[]): number {
  return documents.filter((d) => d.documentType === 'INVOICE' && d.status === 'PAID').reduce((sum, d) => sum + d.grandTotal, 0)
}

/** Sum of grandTotal across INVOICE documents still awaiting payment. invoicedSalesTotal = outstandingInvoiceTotal + paidSalesTotal. */
export function outstandingInvoiceTotal(documents: DocumentRecord[]): number {
  return documents.filter((d) => d.documentType === 'INVOICE' && d.status === 'APPROVED').reduce((sum, d) => sum + d.grandTotal, 0)
}

export interface InvoicedVsPaidMonthly {
  /** "YYYY-MM" */
  key: string
  /** Thai short month label, e.g. "ก.ค." */
  label: string
  invoiced: number
  paid: number
}

/**
 * Monthly INVOICE totals for the bar chart comparing invoiced sales vs paid
 * sales, bucketed by issueDate's month for the `monthsBack` months ending at
 * `now`. Always returns exactly `monthsBack` buckets, oldest first, even for
 * months with zero documents, so the chart's x-axis stays stable. `now` is
 * injectable for deterministic tests.
 */
export function invoicedVsPaidMonthly(
  documents: DocumentRecord[],
  monthsBack = 6,
  now: Date = new Date(),
): InvoicedVsPaidMonthly[] {
  const monthFormatter = new Intl.DateTimeFormat('th-TH', { month: 'short' })
  const buckets: InvoicedVsPaidMonthly[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label: monthFormatter.format(bucketDate), invoiced: 0, paid: 0 })
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const doc of documents) {
    if (doc.documentType !== 'INVOICE') continue
    if (doc.status !== 'APPROVED' && doc.status !== 'PAID') continue
    const bucket = byKey.get(doc.issueDate.slice(0, 7))
    if (!bucket) continue
    bucket.invoiced += doc.grandTotal
    if (doc.status === 'PAID') bucket.paid += doc.grandTotal
  }

  return buckets
}

export interface CustomerTotal {
  customerId: string
  total: number
  documentCount: number
}

/** Sums grandTotal per customer from INVOICE documents (APPROVED or PAID), sorted highest total first, capped at `limit`. */
export function topCustomersByAmount(documents: DocumentRecord[], limit = 5): CustomerTotal[] {
  return invoiceCustomerTotals(documents)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/** Counts INVOICE documents per customer (APPROVED or PAID), sorted highest count first, capped at `limit`. */
export function topCustomersByFrequency(documents: DocumentRecord[], limit = 5): CustomerTotal[] {
  return invoiceCustomerTotals(documents)
    .sort((a, b) => b.documentCount - a.documentCount)
    .slice(0, limit)
}

function invoiceCustomerTotals(documents: DocumentRecord[]): CustomerTotal[] {
  const totals = new Map<string, CustomerTotal>()
  for (const doc of documents) {
    if (doc.documentType !== 'INVOICE') continue
    if (doc.status !== 'APPROVED' && doc.status !== 'PAID') continue
    if (!doc.customerId) continue
    const existing = totals.get(doc.customerId) ?? { customerId: doc.customerId, total: 0, documentCount: 0 }
    existing.total += doc.grandTotal
    existing.documentCount += 1
    totals.set(doc.customerId, existing)
  }
  return Array.from(totals.values())
}

export type QuotationTrackingStatus = 'DRAFT' | 'APPROVED' | 'CONVERTED_TO_INVOICE' | 'PAID' | 'CANCELLED'

export interface QuotationTracking {
  document: DocumentRecord
  trackingStatus: QuotationTrackingStatus
}

/**
 * Derives each quotation's real-world status by walking its downstream
 * conversion chain (source_document_id) for a converted INVOICE — a
 * display-only status, never written back to the database. `allDocuments`
 * must be the *unfiltered* full set (a quotation's downstream invoice may
 * fall outside the visible date range); `quotationsInRange` is the subset
 * of QUOTATION documents actually shown.
 */
export function trackQuotationStatuses(
  allDocuments: DocumentRecord[],
  quotationsInRange: DocumentRecord[],
): QuotationTracking[] {
  return quotationsInRange.map((quotation) => {
    if (quotation.status === 'DRAFT') return { document: quotation, trackingStatus: 'DRAFT' as const }
    if (quotation.status === 'CANCELLED') return { document: quotation, trackingStatus: 'CANCELLED' as const }

    const convertedInvoices = allDocuments.filter(
      (d) => d.sourceDocumentId === quotation.id && d.documentType === 'INVOICE',
    )
    if (convertedInvoices.length === 0) {
      return { document: quotation, trackingStatus: 'APPROVED' as const }
    }
    if (convertedInvoices.some((invoice) => invoice.status === 'PAID')) {
      return { document: quotation, trackingStatus: 'PAID' as const }
    }
    if (convertedInvoices.some((invoice) => invoice.status === 'APPROVED')) {
      return { document: quotation, trackingStatus: 'CONVERTED_TO_INVOICE' as const }
    }
    return { document: quotation, trackingStatus: 'APPROVED' as const }
  })
}
