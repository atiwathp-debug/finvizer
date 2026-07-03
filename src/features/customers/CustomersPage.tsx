import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { FilterBar } from '@/components/shared/FilterBar'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { createCustomer, listCustomers, softDeleteCustomer, updateCustomer } from '@/lib/supabase/customers'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { toast } from '@/stores/toastStore'
import type { CustomerFormValues } from '@/lib/validations/customer'
import type { Customer } from '@/types/customer'

const PAGE_SIZE = 10

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value ?? '—'}</dd>
    </div>
  )
}

export function CustomersPage() {
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const canManage = useHasCompanyRole(['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR'])

  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formTarget, setFormTarget] = useState<Customer | 'new' | null>(null)
  const [viewTarget, setViewTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      setCustomers(await listCustomers(company.id))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search])

  const filtered = useMemo(() => {
    if (!customers) return []
    const q = search.trim().toLowerCase()
    if (q.length === 0) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        (c.taxId ?? '').includes(q),
    )
  }, [customers, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFormSubmit = async (values: CustomerFormValues) => {
    if (!user || !company) return
    setIsSubmitting(true)
    try {
      if (formTarget && formTarget !== 'new') {
        const updated = await updateCustomer(formTarget.id, values)
        void logAuditEvent({
          companyId: company.id,
          actorId: user.id,
          action: 'UPDATE_CUSTOMER',
          entityType: 'customer',
          entityId: updated.id,
        })
        toast({ title: 'บันทึกข้อมูลลูกค้าสำเร็จ', tone: 'success' })
      } else {
        const created = await createCustomer(company.id, user.id, values)
        void logAuditEvent({
          companyId: company.id,
          actorId: user.id,
          action: 'CREATE_CUSTOMER',
          entityType: 'customer',
          entityId: created.id,
        })
        toast({ title: 'เพิ่มลูกค้าสำเร็จ', tone: 'success' })
      }
      setFormTarget(null)
      await load()
    } catch (error) {
      toast({
        title: formTarget && formTarget !== 'new' ? 'บันทึกไม่สำเร็จ' : 'เพิ่มลูกค้าไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!user || !company || !deleteTarget) return
    try {
      await softDeleteCustomer(deleteTarget.id, user.id)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'SOFT_DELETE_CUSTOMER',
        entityType: 'customer',
        entityId: deleteTarget.id,
      })
      toast({ title: 'ลบลูกค้าสำเร็จ', tone: 'success' })
      setViewTarget(null)
      await load()
    } catch (error) {
      toast({
        title: 'ลบไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  const columns: DataTableColumn<Customer>[] = [
    { key: 'name', header: 'ชื่อลูกค้า', render: (c) => <span className="font-medium text-ink">{c.name}</span> },
    { key: 'code', header: 'รหัสลูกค้า', render: (c) => c.customerCode },
    { key: 'taxId', header: 'เลขผู้เสียภาษี', render: (c) => c.taxId ?? '—' },
    { key: 'contact', header: 'ผู้ติดต่อ', render: (c) => c.contactName ?? '—' },
    { key: 'phone', header: 'เบอร์โทร', render: (c) => c.phone ?? '—' },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'จัดการ',
            render: (c: Customer) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setFormTarget(c)}
                  aria-label={`แก้ไข ${c.name}`}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`ลบ ${c.name}`}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ),
          } satisfies DataTableColumn<Customer>,
        ]
      : []),
  ]

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ลูกค้า"
        description="จัดการข้อมูลลูกค้าทั้งหมดของบริษัท"
        actions={
          canManage && (
            <Button onClick={() => setFormTarget('new')}>
              <UserPlus className="size-4" aria-hidden="true" />
              เพิ่มลูกค้า
            </Button>
          )
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="ค้นหาชื่อลูกค้า รหัส หรือเลขผู้เสียภาษี..."
      />

      {customers === null ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={search ? 'ไม่พบลูกค้าที่ตรงกับคำค้นหา' : 'ยังไม่มีลูกค้า'}
          description={search ? 'ลองค้นหาด้วยคำอื่น' : 'เริ่มเพิ่มลูกค้ารายแรกของคุณได้เลย'}
        />
      ) : (
        <>
          <DataTable columns={columns} rows={paged} getRowKey={(row) => row.id} onRowClick={setViewTarget} />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      {/* Create / edit */}
      <Dialog open={formTarget !== null} onOpenChange={(open) => !open && setFormTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogTitle>{formTarget && formTarget !== 'new' ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</DialogTitle>
          <DialogDescription>กรอกข้อมูลลูกค้า — เฉพาะรหัสลูกค้าและชื่อลูกค้าที่จำเป็นต้องกรอก</DialogDescription>
          <div className="mt-4">
            <CustomerForm
              customer={formTarget && formTarget !== 'new' ? formTarget : null}
              isSubmitting={isSubmitting}
              onSubmit={(values) => void handleFormSubmit(values)}
              onCancel={() => setFormTarget(null)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Read-only view */}
      <Dialog open={viewTarget !== null} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          {viewTarget && (
            <>
              <DialogTitle>{viewTarget.name}</DialogTitle>
              <DialogDescription>รหัสลูกค้า {viewTarget.customerCode}</DialogDescription>
              <dl className="mt-4 space-y-2 text-sm">
                <DetailRow label="เลขประจำตัวผู้เสียภาษี / บัตรประชาชน" value={viewTarget.taxId} />
                <DetailRow label="สาขา" value={viewTarget.branch} />
                <DetailRow label="ที่อยู่" value={viewTarget.address} />
                <DetailRow label="เบอร์โทร" value={viewTarget.phone} />
                <DetailRow label="อีเมล" value={viewTarget.email} />
                <DetailRow label="ผู้ติดต่อ" value={viewTarget.contactName} />
                <DetailRow label="หมายเหตุ" value={viewTarget.note} />
              </dl>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setViewTarget(null)}>
                  ปิด
                </Button>
                {canManage && (
                  <>
                    <Button variant="secondary" onClick={() => setFormTarget(viewTarget)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setDeleteTarget(viewTarget)
                        setViewTarget(null)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      ลบ
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ลบลูกค้า"
        description={`ต้องการลบ ${deleteTarget?.name ?? ''} ใช่หรือไม่ — รายการเอกสารเดิมของลูกค้ารายนี้จะไม่ถูกลบ`}
        confirmLabel="ลบลูกค้า"
        tone="danger"
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
