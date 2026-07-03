import type { DocumentRecord, DocumentStatus } from '@/types/document'

/** Counts of each document status — the dashboard's stat-card numbers. */
export function groupDocumentsByStatus(documents: DocumentRecord[]): Record<DocumentStatus, number> {
  const counts: Record<DocumentStatus, number> = { DRAFT: 0, APPROVED: 0, PAID: 0, CANCELLED: 0 }
  for (const doc of documents) counts[doc.status]++
  return counts
}

export interface DashboardStats {
  totalDocuments: number
  draftCount: number
  approvedCount: number
  paidCount: number
  cancelledCount: number
  /** Sum of grandTotal across PAID documents — realized revenue. */
  totalRevenue: number
  /** Sum of grandTotal across APPROVED (not yet paid) documents. */
  outstandingAmount: number
}

export function computeDashboardStats(documents: DocumentRecord[]): DashboardStats {
  const byStatus = groupDocumentsByStatus(documents)
  return {
    totalDocuments: documents.length,
    draftCount: byStatus.DRAFT,
    approvedCount: byStatus.APPROVED,
    paidCount: byStatus.PAID,
    cancelledCount: byStatus.CANCELLED,
    totalRevenue: documents.filter((d) => d.status === 'PAID').reduce((sum, d) => sum + d.grandTotal, 0),
    outstandingAmount: documents.filter((d) => d.status === 'APPROVED').reduce((sum, d) => sum + d.grandTotal, 0),
  }
}

export interface MonthlyTotal {
  /** "YYYY-MM" */
  key: string
  /** Thai short month label, e.g. "ก.ค." */
  label: string
  total: number
}

/**
 * Sums grandTotal (APPROVED or PAID documents only — Draft/Cancelled
 * aren't committed revenue) by issueDate's month, for the `monthsBack`
 * months ending at `now`. Always returns exactly `monthsBack` buckets,
 * oldest first, even for months with zero documents, so the chart's
 * x-axis stays stable. `now` defaults to the real current date but is
 * injectable for deterministic tests.
 */
export function monthlyTotals(documents: DocumentRecord[], monthsBack = 6, now: Date = new Date()): MonthlyTotal[] {
  const monthFormatter = new Intl.DateTimeFormat('th-TH', { month: 'short' })
  const buckets: MonthlyTotal[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label: monthFormatter.format(bucketDate), total: 0 })
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const doc of documents) {
    if (doc.status !== 'APPROVED' && doc.status !== 'PAID') continue
    const bucket = byKey.get(doc.issueDate.slice(0, 7))
    if (bucket) bucket.total += doc.grandTotal
  }

  return buckets
}

export interface CustomerTotal {
  customerId: string
  total: number
  documentCount: number
}

/**
 * Sums grandTotal (APPROVED or PAID only) per customer, sorted highest
 * first, capped at `limit`. Returns bare customerId — joining against a
 * customer's display name is the caller's job (this stays a pure
 * function over DocumentRecord[] alone, no Customer[] dependency).
 */
export function customerTotals(documents: DocumentRecord[], limit = 5): CustomerTotal[] {
  const totals = new Map<string, CustomerTotal>()
  for (const doc of documents) {
    if (doc.status !== 'APPROVED' && doc.status !== 'PAID') continue
    if (!doc.customerId) continue
    const existing = totals.get(doc.customerId) ?? { customerId: doc.customerId, total: 0, documentCount: 0 }
    existing.total += doc.grandTotal
    existing.documentCount += 1
    totals.set(doc.customerId, existing)
  }
  return Array.from(totals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/** Most recently created documents first, capped at `limit` — the dashboard's "recent documents" table. */
export function recentDocuments(documents: DocumentRecord[], limit = 5): DocumentRecord[] {
  return [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
