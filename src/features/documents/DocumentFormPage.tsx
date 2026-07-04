import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ErrorState } from '@/components/shared/ErrorState'
import { DocumentForm } from '@/features/documents/DocumentForm'
import { listCustomers } from '@/lib/supabase/customers'
import { listSignatureSlots } from '@/lib/supabase/signatureSlots'
import { listDocumentInstallments } from '@/lib/supabase/documentInstallments'
import { getDocumentById, saveDraftDocument } from '@/lib/supabase/documents'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { toast } from '@/stores/toastStore'
import { documentStatusLabels, type DocumentRecord } from '@/types/document'
import type { DocumentFormValues } from '@/lib/validations/document'
import type { Customer } from '@/types/customer'
import type { SignatureSlot } from '@/types/signature'
import type { ConversionInstallmentPick, DocumentInstallment } from '@/types/documentInstallment'

/**
 * Overrides a fresh conversion Draft's items/discount/installmentNumber to
 * reflect just the picked installment's amount instead of the source
 * document's full copied amount — a purely client-side, pre-save
 * suggestion (production readiness pass 2, "assisted single-step"). The
 * user reviews and can edit everything before saving; nothing here is
 * auto-persisted, and it never touches createDocumentConversion itself.
 */
function applyInstallmentPick(values: DocumentFormValues, pick?: ConversionInstallmentPick): DocumentFormValues {
  if (!pick) return values
  return {
    ...values,
    documentDiscountType: 'AMOUNT',
    documentDiscountValue: 0,
    items: [
      {
        description: `งวดที่ ${pick.installmentNumber} ตามเอกสารต้นทาง${pick.note ? ` (${pick.note})` : ''}`,
        quantity: 1,
        unit: '',
        unitPrice: pick.computedAmount,
        discountType: 'AMOUNT',
        discountValue: 0,
      },
    ],
    installmentNumber: pick.installmentNumber,
  }
}

function toFormValues(document: DocumentRecord, installments: DocumentInstallment[]): DocumentFormValues {
  return {
    documentType: document.documentType,
    customerId: document.customerId ?? '',
    vatMode: document.vatMode,
    issueDate: document.issueDate,
    dueDate: document.dueDate ?? '',
    note: document.note ?? '',
    documentDiscountType: document.documentDiscountType,
    documentDiscountValue: document.documentDiscountValue,
    items: document.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit ?? '',
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
    installmentPlan: installments.length > 0 ? 'INSTALLMENT' : 'FULL',
    installments: installments
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((installment) => ({
        installmentNo: installment.installmentNo,
        amountType: installment.amountType,
        amountValue: installment.amountValue,
        dueDate: installment.dueDate ?? '',
        note: installment.note ?? '',
      })),
    installmentNumber: document.installmentNumber,
  }
}

export function DocumentFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // Only present on the single client-side navigation right after
  // "แปลงเอกสาร" hands off an installment pick — gone on any later reload
  // or revisit of this same edit route, which is exactly the "first load
  // only" behavior this needs (see DocumentDetailPage's handleCreateConversion).
  const installmentPick = (location.state as { installmentPick?: ConversionInstallmentPick } | null)
    ?.installmentPick
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const canManage = useHasCompanyRole(['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR'])

  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [signatureSlots, setSignatureSlots] = useState<SignatureSlot[]>([])
  const [installments, setInstallments] = useState<DocumentInstallment[]>([])
  // undefined = not loaded yet, null = "no id" (create mode) or "not found" (edit mode, checked separately)
  const [existingDocument, setExistingDocument] = useState<DocumentRecord | null | undefined>(
    id ? undefined : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      const [customerList, document, slots] = await Promise.all([
        listCustomers(company.id),
        id ? getDocumentById(id) : Promise.resolve(null),
        listSignatureSlots(company.id),
      ])
      setCustomers(customerList)
      setExistingDocument(document)
      setSignatureSlots(slots)
      setInstallments(document ? await listDocumentInstallments(document.id) : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company, id])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async (values: DocumentFormValues) => {
    if (!user || !company || !customers) return
    const customer = customers.find((c) => c.id === values.customerId)
    if (!customer) return // Zod already requires a customerId bound to one of the rendered <option>s.

    setIsSaving(true)
    try {
      const saved = await saveDraftDocument(id ?? null, company.id, user.id, values, customer)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: id ? 'UPDATE_DOCUMENT_DRAFT' : 'CREATE_DOCUMENT_DRAFT',
        entityType: 'document',
        entityId: saved.id,
      })
      toast({ title: id ? 'บันทึกการเปลี่ยนแปลงสำเร็จ' : 'สร้างฉบับร่างสำเร็จ', tone: 'success' })
      if (!id) {
        // The Draft now has a real id — move the URL to its edit route so
        // further saves are updates, not repeated creates.
        navigate(`/documents/${saved.id}/edit`, { replace: true })
      } else {
        setExistingDocument(saved)
      }
    } catch (error) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  if (customers === null || existingDocument === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        กำลังโหลด...
      </div>
    )
  }

  if (id && existingDocument === null) {
    return <ErrorState title="ไม่พบเอกสาร" description="เอกสารนี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง" />
  }

  if (existingDocument && existingDocument.status !== 'DRAFT') {
    return (
      <ErrorState
        title="ไม่สามารถแก้ไขได้"
        description={`เอกสารนี้อยู่ในสถานะ "${documentStatusLabels[existingDocument.status]}" แล้ว จึงไม่สามารถแก้ไขได้ — แก้ไขได้เฉพาะฉบับร่างเท่านั้น`}
      />
    )
  }

  if (!canManage) {
    return <ErrorState title="ไม่มีสิทธิ์เข้าถึง" description="คุณไม่มีสิทธิ์สร้างหรือแก้ไขเอกสาร" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={existingDocument ? 'แก้ไขฉบับร่าง' : 'สร้างเอกสารใหม่'}
        description="เอกสารจะถูกบันทึกเป็นฉบับร่าง — ยังไม่มีเลขที่เอกสารจนกว่าจะอนุมัติ"
      />
      <DocumentForm
        company={company}
        customers={customers}
        signatureSlots={signatureSlots}
        initialValues={
          existingDocument
            ? applyInstallmentPick(toFormValues(existingDocument, installments), installmentPick)
            : undefined
        }
        isSaving={isSaving}
        onSave={(values) => void handleSave(values)}
        onCancel={() => navigate('/documents')}
      />
    </div>
  )
}
