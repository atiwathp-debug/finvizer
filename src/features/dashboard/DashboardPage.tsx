import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, FileClock, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatCardSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { Badge } from '@/components/ui/Badge'
import { listDocuments } from '@/lib/supabase/documents'
import { listCustomers } from '@/lib/supabase/customers'
import { useCompanyStore } from '@/stores/companyStore'
import {
  defaultDashboardDateRange,
  dueSoonInvoices,
  filterDocumentsByDateRange,
  invoicedSalesTotal,
  invoicedVsPaidMonthly,
  paidSalesTotal,
  pendingApprovalCount,
  pendingApprovalDocuments,
  topCustomersByAmount,
  topCustomersByFrequency,
  trackQuotationStatuses,
  unpaidInvoices,
  type QuotationTracking,
  type QuotationTrackingStatus,
} from '@/lib/reports/documentReports'
import { formatThaiDate, formatTHB } from '@/lib/utils/currency'
import { documentTypeLabels, type DocumentRecord } from '@/types/document'
import type { Customer } from '@/types/customer'

const quotationTrackingLabels: Record<QuotationTrackingStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  APPROVED: 'อนุมัติแล้ว รอแปลงเป็นใบแจ้งหนี้',
  CONVERTED_TO_INVOICE: 'แปลงเป็นใบแจ้งหนี้แล้ว',
  PAID: 'ชำระแล้ว',
  CANCELLED: 'ยกเลิก',
}

const quotationTrackingTone: Record<QuotationTrackingStatus, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'neutral',
  APPROVED: 'brand',
  CONVERTED_TO_INVOICE: 'warning',
  PAID: 'success',
  CANCELLED: 'danger',
}

export function DashboardPage() {
  const company = useCompanyStore((state) => state.company)
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(() => defaultDashboardDateRange())

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      const [documentList, customerList] = await Promise.all([
        listDocuments(company.id),
        listCustomers(company.id),
      ])
      setDocuments(documentList)
      setCustomers(customerList)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company])

  useEffect(() => {
    void load()
  }, [load])

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const customer of customers) map.set(customer.id, customer.name)
    return map
  }, [customers])

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  const isLoading = documents === null
  const filtered = isLoading ? [] : filterDocumentsByDateRange(documents, dateRange.start, dateRange.end)

  const pendingCount = isLoading ? 0 : pendingApprovalCount(filtered)
  const pendingDocuments = isLoading ? [] : pendingApprovalDocuments(filtered)
  const unpaidInvoiceDocuments = isLoading ? [] : unpaidInvoices(filtered)
  const unpaidInvoiceCount = isLoading ? 0 : unpaidInvoices(filtered, Number.POSITIVE_INFINITY).length
  // Intentionally scoped to the full, unfiltered `documents` list, not
  // `filtered` — this is an operational "collect this now" reminder tied to
  // today's date, not a historical metric, so it must never be hidden by
  // the dashboard's issue-date-range picker.
  const dueSoonDocuments = isLoading ? [] : dueSoonInvoices(documents)
  const dueSoonCount = isLoading ? 0 : dueSoonInvoices(documents, Number.POSITIVE_INFINITY).length
  const invoiced = isLoading ? 0 : invoicedSalesTotal(filtered)
  const paid = isLoading ? 0 : paidSalesTotal(filtered)
  const monthly = isLoading ? [] : invoicedVsPaidMonthly(filtered)
  const byAmount = isLoading
    ? []
    : topCustomersByAmount(filtered).map((entry) => ({
        ...entry,
        name: customerNameById.get(entry.customerId) ?? 'ลูกค้าที่ถูกลบ',
      }))
  const byFrequency = isLoading
    ? []
    : topCustomersByFrequency(filtered).map((entry) => ({
        ...entry,
        name: customerNameById.get(entry.customerId) ?? 'ลูกค้าที่ถูกลบ',
      }))
  const quotationsInRange = isLoading ? [] : filtered.filter((d) => d.documentType === 'QUOTATION')
  const quotationTracking = isLoading ? [] : trackQuotationStatuses(documents, quotationsInRange)

  const quotationColumns: DataTableColumn<QuotationTracking>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      render: (row) => (
        <span className="font-medium text-ink">{row.document.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}</span>
      ),
    },
    {
      key: 'customer',
      header: 'ลูกค้า',
      render: (row) => customerNameById.get(row.document.customerId ?? '') ?? 'ลูกค้าที่ถูกลบ',
    },
    { key: 'date', header: 'วันที่', render: (row) => formatThaiDate(row.document.issueDate) },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => <Badge tone={quotationTrackingTone[row.trackingStatus]}>{quotationTrackingLabels[row.trackingStatus]}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="แดชบอร์ด" description="ภาพรวมเอกสารและยอดขายของบริษัทคุณ" />

      <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="จำนวนเอกสารที่รอการอนุมัติ" value={`${pendingCount} ฉบับ`} icon={FileClock} tone="accent" />
            <StatCard label="ยอดขายที่ออกใบแจ้งหนี้" value={formatTHB(invoiced)} icon={BadgeCheck} tone="brand" />
            <StatCard label="ยอดขายที่มีการชำระเงินแล้ว" value={formatTHB(paid)} icon={Wallet} tone="brand" />
          </>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink">เอกสารที่รอการอนุมัติ</h2>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : pendingDocuments.length === 0 ? (
          <EmptyState icon={FileClock} title="ไม่มีเอกสารรออนุมัติในช่วงวันที่นี้" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {pendingDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-surface"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {documentTypeLabels[doc.documentType]} · {customerNameById.get(doc.customerId ?? '') ?? 'ลูกค้าที่ถูกลบ'}
                      </p>
                      <p className="text-xs text-ink-muted">{formatThaiDate(doc.issueDate)}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatTHB(doc.grandTotal)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {pendingCount > pendingDocuments.length && (
              <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">
                แสดงล่าสุด {pendingDocuments.length} รายการ
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink">ใบแจ้งหนี้ค้างชำระ</h2>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : unpaidInvoiceDocuments.length === 0 ? (
          <EmptyState icon={Wallet} title="ไม่มีใบแจ้งหนี้ค้างชำระในช่วงวันที่นี้" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {unpaidInvoiceDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-surface"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {doc.documentNumber ?? documentTypeLabels[doc.documentType]} ·{' '}
                        {customerNameById.get(doc.customerId ?? '') ?? 'ลูกค้าที่ถูกลบ'}
                      </p>
                      <p className="text-xs text-ink-muted">{formatThaiDate(doc.dueDate ?? doc.issueDate)}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatTHB(doc.grandTotal)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {unpaidInvoiceCount > unpaidInvoiceDocuments.length && (
              <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">
                แสดงล่าสุด {unpaidInvoiceDocuments.length} รายการ
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink">รายการใกล้ครบกำหนดเรียกเก็บเงินใน 2 วัน</h2>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : dueSoonDocuments.length === 0 ? (
          <EmptyState icon={FileClock} title="ไม่มีรายการใกล้ครบกำหนดเรียกเก็บเงินใน 2 วันนี้" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {dueSoonDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-surface"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {doc.documentNumber ?? documentTypeLabels[doc.documentType]} ·{' '}
                        {customerNameById.get(doc.customerId ?? '') ?? 'ลูกค้าที่ถูกลบ'}
                      </p>
                      <p className="text-xs text-ink-muted">{formatThaiDate(doc.dueDate as string)}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatTHB(doc.grandTotal)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {dueSoonCount > dueSoonDocuments.length && (
              <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">
                แสดงล่าสุด {dueSoonDocuments.length} รายการ
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-medium text-ink">ใบแจ้งหนี้: ยอดออกใบแจ้งหนี้ เทียบกับ ยอดที่ชำระแล้ว</h2>
        <div className="mt-4 h-64">
          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ left: -20, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatTHB(Number(value))}
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 13 }}
                />
                <Legend formatter={(value) => (value === 'invoiced' ? 'ออกใบแจ้งหนี้' : 'ชำระแล้ว')} />
                <Bar dataKey="invoiced" name="invoiced" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="paid" name="paid" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-ink">ลูกค้าที่มียอดขายสูงสุด</h2>
          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : byAmount.length === 0 ? (
            <EmptyState icon={Wallet} title="ยังไม่มียอดขายจากใบแจ้งหนี้" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <ul className="divide-y divide-line">
                {byAmount.map((entry) => (
                  <li key={entry.customerId} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{entry.name}</p>
                      <p className="text-xs text-ink-muted">{entry.documentCount} ฉบับ</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatTHB(entry.total)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-ink">ลูกค้าที่ซื้อบ่อยที่สุด</h2>
          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : byFrequency.length === 0 ? (
            <EmptyState icon={Wallet} title="ยังไม่มีใบแจ้งหนี้" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <ul className="divide-y divide-line">
                {byFrequency.map((entry) => (
                  <li key={entry.customerId} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{entry.name}</p>
                      <p className="text-xs text-ink-muted">{formatTHB(entry.total)}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{entry.documentCount} ฉบับ</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink">ติดตามสถานะใบเสนอราคา</h2>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : quotationTracking.length === 0 ? (
          <EmptyState icon={FileClock} title="ยังไม่มีใบเสนอราคาในช่วงวันที่นี้" />
        ) : (
          <DataTable columns={quotationColumns} rows={quotationTracking} getRowKey={(row) => row.document.id} />
        )}
      </div>
    </div>
  )
}
