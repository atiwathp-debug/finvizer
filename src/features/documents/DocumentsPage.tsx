import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileX2, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { FilterBar } from '@/components/shared/FilterBar'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Pagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { listDocuments } from '@/lib/supabase/documents'
import { listCustomers } from '@/lib/supabase/customers'
import { useCompanyStore } from '@/stores/companyStore'
import { documentStatusLabels, documentTypeLabels, type DocumentRecord, type DocumentStatus, type DocumentType } from '@/types/document'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import type { Customer } from '@/types/customer'

const PAGE_SIZE = 10

export function DocumentsPage() {
  const navigate = useNavigate()
  const company = useCompanyStore((state) => state.company)

  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)

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

  useEffect(() => {
    setPage(1)
  }, [search, typeFilter, statusFilter])

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const customer of customers) map.set(customer.id, customer.name)
    return map
  }, [customers])

  const columns: DataTableColumn<DocumentRecord>[] = useMemo(
    () => [
      {
        key: 'number',
        header: 'เลขที่เอกสาร',
        render: (row) => (
          <span className={row.documentNumber ? 'font-medium text-ink' : 'text-ink-muted italic'}>
            {row.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
          </span>
        ),
      },
      { key: 'type', header: 'ประเภท', render: (row) => documentTypeLabels[row.documentType] },
      {
        key: 'customer',
        header: 'ลูกค้า',
        render: (row) => (row.customerId ? (customerNameById.get(row.customerId) ?? '—') : '—'),
      },
      { key: 'date', header: 'วันที่ออกเอกสาร', render: (row) => formatThaiDate(row.issueDate) },
      { key: 'status', header: 'สถานะ', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'total', header: 'ยอดรวม', align: 'right', render: (row) => formatTHB(row.grandTotal) },
    ],
    [customerNameById],
  )

  const filtered = useMemo(() => {
    if (!documents) return []
    const q = search.trim().toLowerCase()
    return documents.filter((doc) => {
      const customerName = doc.customerId ? (customerNameById.get(doc.customerId) ?? '') : ''
      const matchesSearch =
        q.length === 0 ||
        customerName.toLowerCase().includes(q) ||
        (doc.documentNumber?.toLowerCase().includes(q) ?? false)
      const matchesType = typeFilter === 'ALL' || doc.documentType === typeFilter
      const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [documents, search, typeFilter, statusFilter, customerNameById])

  const hasActiveFilters = search.length > 0 || typeFilter !== 'ALL' || statusFilter !== 'ALL'
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="เอกสาร"
        description="จัดการใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และเอกสารอื่น ๆ ทั้งหมด"
        actions={
          <Button asChild>
            <Link to="/documents/new">
              <Plus className="size-4" aria-hidden="true" />
              สร้างเอกสารใหม่
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="ค้นหาเลขที่เอกสารหรือลูกค้า..."
      >
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'ALL')}
          aria-label="กรองตามประเภทเอกสาร"
          className="w-auto min-w-40"
        >
          <option value="ALL">ทุกประเภทเอกสาร</option>
          {Object.entries(documentTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'ALL')}
          aria-label="กรองตามสถานะ"
          className="w-auto min-w-36"
        >
          <option value="ALL">ทุกสถานะ</option>
          {Object.entries(documentStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {documents === null ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileX2}
          title={hasActiveFilters ? 'ไม่พบเอกสารที่ตรงกับตัวกรอง' : 'ยังไม่มีเอกสาร'}
          description={
            hasActiveFilters
              ? 'ลองปรับคำค้นหาหรือตัวกรองใหม่อีกครั้ง'
              : 'เริ่มสร้างเอกสารฉบับแรกของคุณได้เลย'
          }
          action={
            !hasActiveFilters && (
              <Button asChild size="sm">
                <Link to="/documents/new">สร้างเอกสารใหม่</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/documents/${row.id}`)}
          />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
