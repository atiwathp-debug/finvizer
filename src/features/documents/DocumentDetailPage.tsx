import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRightLeft, Download, GitBranch, Loader2, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DocumentPreview } from '@/features/documents/DocumentPreview'
import { DocumentTimeline } from '@/features/documents/DocumentTimeline'
import { listCustomers } from '@/lib/supabase/customers'
import {
  approveDocument,
  cancelDocument,
  createDocumentConversion,
  createDocumentRevision,
  getDocumentById,
  listDocumentConversions,
  listDocumentRevisions,
  markDocumentPaid,
} from '@/lib/supabase/documents'
import { listAuditLogsForEntity, logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { canApproveDocument, canEditDocument, canMarkDocumentPaid } from '@/lib/permissions/documentPermissions'
import { toast } from '@/stores/toastStore'
import { documentConversionMap, documentTypeLabels, revisionLabel, type DocumentRecord, type DocumentType } from '@/types/document'
import type { DocumentTotalsResult } from '@/lib/calculations/documentTotals'
import type { AuditLogRecord } from '@/types/auditLog'
import type { Customer } from '@/types/customer'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const currentUserRole = useCompanyStore((state) => state.currentUserRole)
  const canEdit = canEditDocument(currentUserRole)
  const canApprove = canApproveDocument(currentUserRole)

  const [document, setDocument] = useState<DocumentRecord | null | undefined>(undefined)
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [originalDocument, setOriginalDocument] = useState<DocumentRecord | null>(null)
  const [revisions, setRevisions] = useState<DocumentRecord[]>([])
  const [sourceDocument, setSourceDocument] = useState<DocumentRecord | null>(null)
  const [conversions, setConversions] = useState<DocumentRecord[]>([])
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [convertTargetType, setConvertTargetType] = useState<DocumentType | ''>('')

  const load = useCallback(async () => {
    if (!company || !id) return
    setLoadError(null)
    try {
      const [doc, customerList] = await Promise.all([getDocumentById(id), listCustomers(company.id)])
      setDocument(doc)
      setCustomers(customerList)

      if (doc) {
        const originalId = doc.parentDocumentId ?? doc.id
        const [revisionList, original, conversionList, source, logs] = await Promise.all([
          listDocumentRevisions(originalId),
          doc.parentDocumentId ? getDocumentById(doc.parentDocumentId) : Promise.resolve(doc),
          listDocumentConversions(doc.id),
          doc.sourceDocumentId ? getDocumentById(doc.sourceDocumentId) : Promise.resolve(null),
          listAuditLogsForEntity('document', doc.id),
        ])
        setRevisions(revisionList)
        setOriginalDocument(original)
        setConversions(conversionList)
        setSourceDocument(source)
        setTimelineLogs(logs)
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company, id])

  useEffect(() => {
    void load()
  }, [load])

  const handleApprove = async () => {
    if (!id || !user) return
    setIsActing(true)
    try {
      const saved = await approveDocument(id, user.id)
      await load()
      toast({
        title: 'อนุมัติเอกสารสำเร็จ',
        description: saved.documentNumber ? `เลขที่เอกสาร: ${saved.documentNumber}` : undefined,
        tone: 'success',
      })
    } catch (error) {
      toast({
        title: 'อนุมัติเอกสารไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsActing(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!id || !user) return
    setIsActing(true)
    try {
      await markDocumentPaid(id, user.id)
      await load()
      toast({ title: 'บันทึกการชำระเงินสำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'บันทึกการชำระเงินไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsActing(false)
    }
  }

  const handleCancel = async () => {
    if (!id || !user) return
    setIsActing(true)
    try {
      await cancelDocument(id, user.id)
      await load()
      toast({ title: 'ยกเลิกเอกสารสำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'ยกเลิกเอกสารไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsActing(false)
    }
  }

  const handleCreateRevision = async () => {
    if (!id || !user) return
    setIsActing(true)
    try {
      const revision = await createDocumentRevision(id, user.id)
      toast({ title: 'สร้าง Revision สำเร็จ', tone: 'success' })
      navigate(`/documents/${revision.id}/edit`)
    } catch (error) {
      toast({
        title: 'สร้าง Revision ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsActing(false)
    }
  }

  const handleCreateConversion = async () => {
    if (!id || !user || !convertTargetType) return
    setIsActing(true)
    try {
      const converted = await createDocumentConversion(id, convertTargetType, user.id)
      toast({ title: 'แปลงเอกสารสำเร็จ', tone: 'success' })
      setConvertDialogOpen(false)
      navigate(`/documents/${converted.id}/edit`)
    } catch (error) {
      toast({
        title: 'แปลงเอกสารไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsActing(false)
    }
  }

  const handleExportPdf = async () => {
    if (!document || !company || !user) return
    setIsExportingPdf(true)
    try {
      // Dynamically imported — @react-pdf/renderer is heavy (~1.4MB), so
      // it's split into its own chunk fetched only when a user actually
      // exports a PDF, instead of bloating everyone's initial page load.
      const { documentPdfFileName, generateDocumentPdf } = await import('@/lib/pdf/generateDocumentPdf')
      const customer = customers?.find((c) => c.id === document.customerId) ?? null
      const blob = await generateDocumentPdf({ company, customer, document })
      const url = URL.createObjectURL(blob)
      // window.document, not the `document` state variable shadowing it above.
      const link = window.document.createElement('a')
      link.href = url
      link.download = documentPdfFileName(document, documentTypeLabels[document.documentType])
      link.click()
      URL.revokeObjectURL(url)
      // No RPC involved in exporting a PDF (it's a pure client-side render),
      // so unlike approve/paid/cancel/revision/conversion, the page itself
      // logs this — same reasoning as CREATE_DOCUMENT_DRAFT.
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'EXPORT_DOCUMENT_PDF',
        entityType: 'document',
        entityId: document.id,
        metadata: { documentNumber: document.documentNumber },
      })
      setTimelineLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          companyId: company.id,
          actorId: user.id,
          action: 'EXPORT_DOCUMENT_PDF',
          entityType: 'document',
          entityId: document.id,
          metadata: { documentNumber: document.documentNumber },
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (error) {
      toast({
        title: 'ส่งออก PDF ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  if (document === undefined || customers === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        กำลังโหลด...
      </div>
    )
  }

  if (document === null) {
    return <ErrorState title="ไม่พบเอกสาร" description="เอกสารนี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง" />
  }

  const customer = customers.find((c) => c.id === document.customerId)
  const totals: DocumentTotalsResult = {
    itemAmounts: document.items.map((item) => item.amount),
    subtotal: document.subtotal,
    discountTotal: document.discountTotal,
    vatAmount: document.vatAmount,
    grandTotal: document.grandTotal,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.documentNumber ?? documentTypeLabels[document.documentType]}
        description={documentTypeLabels[document.documentType]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={document.status} />
            <Button variant="secondary" onClick={() => void handleExportPdf()} isLoading={isExportingPdf}>
              <Download className="size-4" aria-hidden="true" />
              ส่งออก PDF
            </Button>
            {document.status === 'DRAFT' && canEdit && (
              <Button asChild variant="secondary">
                <Link to={`/documents/${document.id}/edit`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  แก้ไข
                </Link>
              </Button>
            )}
            {document.status === 'DRAFT' && canApprove && (
              <Button onClick={() => setApproveConfirmOpen(true)} disabled={isActing}>
                อนุมัติเอกสาร
              </Button>
            )}
            {canMarkDocumentPaid(document.documentType, document.status, currentUserRole) && (
              <Button variant="secondary" onClick={() => void handleMarkPaid()} isLoading={isActing}>
                บันทึกว่าชำระแล้ว
              </Button>
            )}
            {document.status === 'APPROVED' && canApprove && (
              <Button variant="danger" onClick={() => setCancelConfirmOpen(true)} disabled={isActing}>
                ยกเลิกเอกสาร
              </Button>
            )}
            {document.status === 'APPROVED' && document.parentDocumentId === null && canEdit && (
              <Button variant="secondary" onClick={() => void handleCreateRevision()} isLoading={isActing}>
                <GitBranch className="size-4" aria-hidden="true" />
                สร้าง Revision
              </Button>
            )}
            {document.status === 'APPROVED' && documentConversionMap[document.documentType].length > 0 && canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setConvertTargetType('')
                  setConvertDialogOpen(true)
                }}
                disabled={isActing}
              >
                <ArrowRightLeft className="size-4" aria-hidden="true" />
                แปลงเอกสาร
              </Button>
            )}
          </div>
        }
      />

      {document.parentDocumentId && (
        <p className="text-sm text-ink-muted">
          Revision {revisionLabel(document.revisionNo) ?? '(ฉบับร่าง)'} ของ{' '}
          <Link to={`/documents/${document.parentDocumentId}`} className="text-brand-600 hover:underline">
            {originalDocument?.documentNumber ?? 'เอกสารต้นฉบับ'}
          </Link>
        </p>
      )}

      {document.sourceDocumentId && (
        <p className="text-sm text-ink-muted">
          แปลงมาจาก{' '}
          <Link to={`/documents/${document.sourceDocumentId}`} className="text-brand-600 hover:underline">
            {sourceDocument ? `${documentTypeLabels[sourceDocument.documentType]} ${sourceDocument.documentNumber ?? ''}` : 'เอกสารต้นทาง'}
          </Link>
        </p>
      )}

      {document.approvedAt && (
        <p className="text-sm text-ink-muted">
          อนุมัติเมื่อ {new Date(document.approvedAt).toLocaleString('th-TH')}
        </p>
      )}

      <DocumentPreview
        companyName={company.nameTh}
        companyAddress={company.address}
        documentTypeLabel={documentTypeLabels[document.documentType]}
        documentNumber={document.documentNumber}
        customerName={customer?.name}
        customerAddress={customer?.address}
        issueDate={document.issueDate}
        dueDate={document.dueDate}
        items={document.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit ?? '',
          unitPrice: item.unitPrice,
          amount: item.amount,
        }))}
        totals={totals}
        vatMode={document.vatMode}
        note={document.note}
      />

      {revisions.length > 0 && originalDocument && (
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <p className="text-sm font-medium text-ink">ประวัติ Revision</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                to={`/documents/${originalDocument.id}`}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                  originalDocument.id === document.id
                    ? 'border-brand-200 bg-brand-50'
                    : 'border-line hover:bg-surface'
                }`}
              >
                <span className="text-ink">
                  ต้นฉบับ · {originalDocument.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
                </span>
                <StatusBadge status={originalDocument.status} />
              </Link>
            </li>
            {revisions.map((revision) => (
              <li key={revision.id}>
                <Link
                  to={`/documents/${revision.id}`}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    revision.id === document.id ? 'border-brand-200 bg-brand-50' : 'border-line hover:bg-surface'
                  }`}
                >
                  <span className="text-ink">
                    {revisionLabel(revision.revisionNo) ?? 'ฉบับร่าง Revision'} ·{' '}
                    {revision.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
                  </span>
                  <StatusBadge status={revision.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conversions.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <p className="text-sm font-medium text-ink">ประวัติการแปลงเอกสาร</p>
          <ul className="mt-3 space-y-2">
            {conversions.map((converted) => (
              <li key={converted.id}>
                <Link
                  to={`/documents/${converted.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface"
                >
                  <span className="text-ink">
                    {documentTypeLabels[converted.documentType]} ·{' '}
                    {converted.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
                  </span>
                  <StatusBadge status={converted.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <p className="text-sm font-medium text-ink">ประวัติกิจกรรม</p>
        <div className="mt-3">
          <DocumentTimeline logs={timelineLogs} />
        </div>
      </div>

      <div>
        <Button variant="ghost" onClick={() => navigate('/documents')}>
          กลับไปหน้ารายการเอกสาร
        </Button>
      </div>

      <ConfirmDialog
        open={approveConfirmOpen}
        onOpenChange={setApproveConfirmOpen}
        title="อนุมัติเอกสาร"
        description="เมื่ออนุมัติแล้ว ระบบจะออกเลขที่เอกสารอย่างเป็นทางการและจะไม่สามารถแก้ไขเอกสารนี้ได้อีก ต้องการดำเนินการต่อหรือไม่"
        confirmLabel="อนุมัติเอกสาร"
        onConfirm={() => void handleApprove()}
      />

      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="ยกเลิกเอกสาร"
        description="เอกสารที่ยกเลิกแล้วจะไม่สามารถแก้ไขหรือกู้คืนได้ ต้องการดำเนินการต่อหรือไม่"
        confirmLabel="ยกเลิกเอกสาร"
        tone="danger"
        onConfirm={() => void handleCancel()}
      />

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogTitle>แปลงเอกสาร</DialogTitle>
          <DialogDescription>
            เลือกประเภทเอกสารที่ต้องการแปลงเป็น ระบบจะสร้างฉบับร่างใหม่โดยคัดลอกข้อมูลลูกค้า รายการสินค้า
            รูปแบบภาษีมูลค่าเพิ่ม หมายเหตุ และยอดรวมจากเอกสารนี้
          </DialogDescription>
          <div className="mt-4">
            <Select
              value={convertTargetType}
              onChange={(e) => setConvertTargetType(e.target.value as DocumentType)}
              aria-label="ประเภทเอกสารปลายทาง"
            >
              <option value="">เลือกประเภทเอกสาร</option>
              {documentConversionMap[document.documentType].map((targetType) => (
                <option key={targetType} value={targetType}>
                  {documentTypeLabels[targetType]}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConvertDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => void handleCreateConversion()}
              disabled={!convertTargetType}
              isLoading={isActing}
            >
              แปลงเอกสาร
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
