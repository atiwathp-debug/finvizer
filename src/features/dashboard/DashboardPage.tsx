import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, BadgeCheck, FileStack, FilePlus2, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/Button'
import { listDocuments } from '@/lib/supabase/documents'
import { listCustomers } from '@/lib/supabase/customers'
import { useCompanyStore } from '@/stores/companyStore'
import {
  computeDashboardStats,
  customerTotals,
  groupDocumentsByStatus,
  monthlyTotals,
  recentDocuments,
} from '@/lib/reports/documentReports'
import { documentStatusLabels, documentTypeLabels, type DocumentRecord } from '@/types/document'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import type { Customer } from '@/types/customer'

const statusOrder = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'] as const

const documentColumns: DataTableColumn<DocumentRecord>[] = [
  {
    key: 'number',
    header: 'เลขที่เอกสาร',
    render: (row) => (
      <Link to={`/documents/${row.id}`} className="font-medium text-brand-700 hover:underline">
        {row.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
      </Link>
    ),
  },
  { key: 'type', header: 'ประเภท', render: (row) => documentTypeLabels[row.documentType] },
  { key: 'date', header: 'วันที่', render: (row) => formatThaiDate(row.issueDate) },
  { key: 'status', header: 'สถานะ', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'total', header: 'ยอดรวม', align: 'right', render: (row) => formatTHB(row.grandTotal) },
]

export function DashboardPage() {
  const company = useCompanyStore((state) => state.company)
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

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
  const stats = isLoading ? null : computeDashboardStats(documents)
  const statusCounts = isLoading ? null : groupDocumentsByStatus(documents)
  const statusChartData = statusCounts
    ? statusOrder.map((status) => ({ status, label: documentStatusLabels[status], count: statusCounts[status] }))
    : []
  const monthly = isLoading ? [] : monthlyTotals(documents)
  const topCustomers = isLoading
    ? []
    : customerTotals(documents).map((entry) => ({
        ...entry,
        name: customerNameById.get(entry.customerId) ?? 'ลูกค้าที่ถูกลบ',
      }))
  const recent = isLoading ? [] : recentDocuments(documents)

  return (
    <div className="space-y-6">
      <PageHeader title="แดชบอร์ด" description="ภาพรวมเอกสารและยอดขายของบริษัทคุณ" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="เอกสารทั้งหมด" value={`${stats.totalDocuments} ฉบับ`} icon={FileStack} tone="brand" />
            <StatCard label="ฉบับร่าง" value={`${stats.draftCount} ฉบับ`} icon={FilePlus2} tone="accent" />
            <StatCard
              label="อนุมัติแล้ว (ค้างชำระ)"
              value={formatTHB(stats.outstandingAmount)}
              icon={BadgeCheck}
              tone="brand"
            />
            <StatCard label="ยอดขายที่ชำระแล้ว" value={formatTHB(stats.totalRevenue)} icon={Wallet} tone="brand" />
            <StatCard label="ยกเลิก" value={`${stats.cancelledCount} ฉบับ`} icon={Ban} tone="accent" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium text-ink">เอกสารแยกตามสถานะ</h2>
          <div className="mt-4 h-64">
            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ left: -20, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [`${value} ฉบับ`, 'จำนวน']}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium text-ink">ยอดรวมรายเดือน (อนุมัติแล้ว/ชำระแล้ว)</h2>
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
                  <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink">ลูกค้าที่มียอดสูงสุด</h2>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : topCustomers.length === 0 ? (
          <EmptyState icon={Wallet} title="ยังไม่มียอดขายที่อนุมัติหรือชำระแล้ว" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {topCustomers.map((entry) => (
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">เอกสารล่าสุด</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/documents">ดูทั้งหมด</Link>
          </Button>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : recent.length === 0 ? (
          <EmptyState icon={FilePlus2} title="ยังไม่มีเอกสาร" description="เริ่มสร้างเอกสารฉบับแรกของคุณได้เลย" />
        ) : (
          <DataTable columns={documentColumns} rows={recent} getRowKey={(row) => row.id} />
        )}
      </div>
    </div>
  )
}
