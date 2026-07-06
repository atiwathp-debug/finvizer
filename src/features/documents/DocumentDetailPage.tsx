import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRightLeft, Download, GitBranch, Loader2, Pencil, Trash2 } from 'lucide-react'
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
import { listSignatureSlots } from '@/lib/supabase/signatureSlots'
import { listDocumentInstallments } from '@/lib/supabase/documentInstallments'
import {
  approveDocument,
  cancelDocument,
  createDocumentConversion,
  createDocumentRevision,
  deleteDraftDocument,
  getDocumentById,
  listDocumentConversions,
  listDocumentRevisions,
  markDocumentPaid,
} from '@/lib/supabase/documents'
import { listAuditLogsForEntity, logAuditEvent } from '@/lib/supabase/auditLog'
import { logError } from '@/lib/utils/debugLog'
import { buildAppUrl } from '@/lib/utils/url'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { canApproveDocument, canEditDocument, canMarkDocumentPaid } from '@/lib/permissions/documentPermissions'
import { toast } from '@/stores/toastStore'
import { documentConversionMap, documentTypeLabels, revisionLabel, type DocumentRecord, type DocumentType } from '@/types/document'
import type { DocumentTotalsResult } from '@/lib/calculations/documentTotals'
import type { AuditLogRecord } from '@/types/auditLog'
import type { Customer } from '@/types/customer'
import type { SignatureSlot } from '@/types/signature'
import type { ConversionInstallmentPick, DocumentInstallment } from '@/types/documentInstallment'

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
  const [signatureSlots, setSignatureSlots] = useState<SignatureSlot[]>([])
  const [installments, setInstallments] = useState<DocumentInstallment[]>([])
  const [originalDocument, setOriginalDocument] = useState<DocumentRecord | null>(null)
  const [revisions, setRevisions] = useState<DocumentRecord[]>([])
  const [sourceDocument, setSourceDocument] = useState<DocumentRecord | null>(null)
  const [conversions, setConversions] = useState<DocumentRecord[]>([])
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [convertTargetType, setConvertTargetType] = useState<DocumentType | ''>('')
  const [convertInstallmentNo, setConvertInstallmentNo] = useState<number | ''>('')

  const load = useCallback(async () => {
    if (!company || !id) return
    setLoadError(null)
    try {
      // Signature slots and installments are non-critical, cosmetic/
      // supplementary data — a failure fetching either (e.g. a pass-2
      // migration not yet applied on this Supabase project) must never
      // block the entire document page from loading, so they're fetched
      // outside the core Promise.all and degrade to an empty list on error
      // (the same fallback as a company/document with none configured).
      const [doc, customerList] = await Promise.all([getDocumentById(id), listCustomers(company.id)])
      const [slots, installmentRows] = await Promise.all([
        listSignatureSlots(company.id).catch((error) => {
          logError('DocumentDetailPage.load.signatureSlots', error, { companyId: company.id })
          return []
        }),
        doc
          ? listDocumentInstallments(doc.id).catch((error) => {
              logError('DocumentDetailPage.load.installments', error, { documentId: doc.id })
              return []
            })
          : Promise.resolve([]),
      ])
      setDocument(doc)
      setCustomers(customerList)
      setSignatureSlots(slots)
      setInstallments(installmentRows)

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

  const handleDelete = async () => {
    if (!id || !user || !company) return
    setIsDeleting(true)
    try {
      // Only DRAFTs are ever deletable — deleteDraftDocument/RLS both
      // enforce this server-side too, so this button never appears (and
      // never needs to succeed) for anything past DRAFT. Approved/numbered
      // documents use "ยกเลิกเอกสาร" (cancel/void) instead, preserving the
      // document number and audit trail — see the button's tooltip below.
      await deleteDraftDocument(id)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'DELETE_DOCUMENT_DRAFT',
        entityType: 'document',
        entityId: id,
      })
      toast({ title: 'ลบฉบับร่างสำเร็จ', tone: 'success' })
      navigate('/documents')
    } catch (error) {
      toast({
        title: 'ลบฉบับร่างไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsDeleting(false)
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
      // createDocumentConversion/create_document_conversion is called with
      // exactly the same 3 arguments as before this feature existed — the
      // picked installment is never sent to it, only used afterward to
      // pre-fill the resulting Draft's edit form client-side (see
      // DocumentFormPage.tsx).
      const converted = await createDocumentConversion(id, convertTargetType, user.id)
      toast({ title: 'แปลงเอกสารสำเร็จ', tone: 'success' })
      setConvertDialogOpen(false)
      const pickedInstallment = installments.find((i) => i.installmentNo === convertInstallmentNo)
      const installmentPick: ConversionInstallmentPick | undefined = pickedInstallment
        ? {
            installmentNumber: pickedInstallment.installmentNo,
            computedAmount: pickedInstallment.computedAmount,
            note: pickedInstallment.note,
          }
        : undefined
      navigate(`/documents/${converted.id}/edit`, installmentPick ? { state: { installmentPick } } : undefined)
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

  // "Export PDF" opens the print route in a new tab — it renders the exact
  // same <DocumentPreview> this page shows and triggers the browser's own
  // print/"Save as PDF" dialog there (see DocumentPrintPage.tsx), instead
  // of a separate react-pdf render that could drift from this preview.
  // That page logs its own EXPORT_DOCUMENT_PDF audit event once loaded.
  const handleExportPdf = () => {
    if (!document) return
    window.open(buildAppUrl(`documents/${document.id}/print`), '_blank', 'noopener,noreferrer')
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
  // PAID blocks editing/cancelling but must not block valid downstream
  // conversion (e.g. a paid INVOICE with no RECEIPT/TAX_INVOICE yet) —
  // see supabase/migrations/20260714120000_conversion_after_paid.sql.
  // Target types already converted-to are excluded so the dialog never
  // offers a duplicate of a conversion that already exists.
  const isConvertibleStatus = document.status === 'APPROVED' || document.status === 'PAID'
  const availableConversionTargets = documentConversionMap[document.documentType].filter(
    (targetType) => !conversions.some((converted) => converted.documentType === targetType),
  )
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
            <Button variant="secondary" onClick={handleExportPdf}>
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
            {document.status === 'DRAFT' && canEdit && (
              <Button
                variant="danger"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isDeleting}
                title="ลบฉบับร่างนี้อย่างถาวร — ใช้ได้เฉพาะฉบับร่างที่ยังไม่มีเลขที่เอกสาร"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                ลบฉบับร่าง
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
              <Button
                variant="danger"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={isActing}
                title="เอกสารที่มีเลขที่เอกสารแล้วไม่สามารถลบได้ — ยกเลิกจะรักษาเลขที่เอกสารและประวัติการใช้งานไว้"
              >
                ยกเลิกเอกสาร
              </Button>
            )}
            {document.status === 'APPROVED' && document.parentDocumentId === null && canEdit && (
              <Button variant="secondary" onClick={() => void handleCreateRevision()} isLoading={isActing}>
                <GitBranch className="size-4" aria-hidden="true" />
                สร้าง Revision
              </Button>
            )}
            {isConvertibleStatus && availableConversionTargets.length > 0 && canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setConvertTargetType('')
                  setConvertInstallmentNo('')
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
        companyTaxId={company.taxId}
        companyPhone={company.phone}
        logoUrl={company.logoUrl}
        logoSize={company.logoSize}
        logoPosition={company.logoPosition}
        template={company.documentTemplate}
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
        signatureSlots={signatureSlots}
        installmentPlan={installments.length > 0 ? 'INSTALLMENT' : 'FULL'}
        installments={installments}
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

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="ลบฉบับร่าง"
        description="ฉบับร่างนี้จะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้ (ยังไม่มีเลขที่เอกสาร จึงลบได้โดยไม่กระทบเลขที่เอกสารหรือประวัติการใช้งานอื่น) ต้องการดำเนินการต่อหรือไม่"
        confirmLabel="ลบฉบับร่าง"
        tone="danger"
        onConfirm={() => void handleDelete()}
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
              {availableConversionTargets.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {documentTypeLabels[targetType]}
                </option>
              ))}
            </Select>
          </div>
          {installments.length > 0 && (
            <div className="mt-4">
              <Select
                value={convertInstallmentNo}
                onChange={(e) => setConvertInstallmentNo(e.target.value ? Number(e.target.value) : '')}
                aria-label="สำหรับงวดที่"
              >
                <option value="">ไม่ระบุ (คัดลอกยอดเต็มจำนวนตามปกติ)</option>
                {installments.map((installment) => (
                  <option key={installment.id} value={installment.installmentNo}>
                    สำหรับงวดที่ {installment.installmentNo}
                    {installment.note ? ` — ${installment.note}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
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
