import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DocumentPreview } from '@/features/documents/DocumentPreview'
import { documentPdfFileName } from '@/features/documents/documentFileName'
import { listCustomers } from '@/lib/supabase/customers'
import { listSignatureSlots } from '@/lib/supabase/signatureSlots'
import { listDocumentInstallments } from '@/lib/supabase/documentInstallments'
import { getDocumentById } from '@/lib/supabase/documents'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { logError } from '@/lib/utils/debugLog'
import { canExportDocumentPdf } from '@/lib/permissions/documentPermissions'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { resolveDocumentTypeLabel } from '@/lib/templates/documentTemplateText'
import { documentTypeLabels, type DocumentRecord } from '@/types/document'
import type { DocumentTotalsResult } from '@/lib/calculations/documentTotals'
import type { Customer } from '@/types/customer'
import type { SignatureSlot } from '@/types/signature'
import type { DocumentInstallment } from '@/types/documentInstallment'

/**
 * "Export PDF" for a document is printing this route, not a separate
 * react-pdf render — see DocumentDetailPage's "ส่งออก PDF" button, which
 * just opens this route in a new tab. Rendering the exact same
 * <DocumentPreview> the user already sees on the detail page guarantees
 * the exported/printed output can never drift from the on-screen preview
 * (the two-renderer split that caused repeated layout mismatches is gone).
 *
 * No AppShell here on purpose — this route sits outside it in
 * routes/index.tsx — so there's no sidebar/topbar/toast to hide via print
 * CSS; the whole page already is just the document sheet.
 */
export function DocumentPrintPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)

  const [document, setDocument] = useState<DocumentRecord | null | undefined>(undefined)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [signatureSlots, setSignatureSlots] = useState<SignatureSlot[]>([])
  const [installments, setInstallments] = useState<DocumentInstallment[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasLoggedExport = useRef(false)

  const load = useCallback(async () => {
    if (!company || !id) return
    try {
      const doc = await getDocumentById(id)
      setDocument(doc)
      const [customerList, slots, installmentRows] = await Promise.all([
        listCustomers(company.id),
        listSignatureSlots(company.id).catch((error) => {
          logError('DocumentPrintPage.load.signatureSlots', error, { companyId: company.id })
          return []
        }),
        doc
          ? listDocumentInstallments(doc.id).catch((error) => {
              logError('DocumentPrintPage.load.installments', error, { documentId: doc.id })
              return []
            })
          : Promise.resolve([]),
      ])
      setCustomers(customerList)
      setSignatureSlots(slots)
      setInstallments(installmentRows)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company, id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!document || !company) return
    // A DRAFT has no document number yet and its content can still change
    // freely — never auto-print or log an export for one (see
    // canExportDocumentPdf's comment). The render below shows a blocking
    // message instead of the preview for this same case.
    if (!canExportDocumentPdf(document.status)) return
    window.document.title = documentPdfFileName(document, documentTypeLabels[document.documentType])
    if (hasLoggedExport.current || !user) return
    hasLoggedExport.current = true
    void logAuditEvent({
      companyId: company.id,
      actorId: user.id,
      action: 'EXPORT_DOCUMENT_PDF',
      entityType: 'document',
      entityId: document.id,
      metadata: { documentNumber: document.documentNumber },
    })
    // Short delay lets the logo <img> (and web fonts) finish loading before
    // the browser rasterizes the print output — printing too early can
    // render a blank/broken logo box.
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [document, company, user])

  if (loadError) {
    return <p className="p-6 text-sm text-red-600">{loadError}</p>
  }

  if (!company || document === undefined) {
    return <p className="p-6 text-sm text-ink-muted">กำลังโหลด...</p>
  }

  if (document === null) {
    return <p className="p-6 text-sm text-ink-muted">ไม่พบเอกสาร</p>
  }

  if (!canExportDocumentPdf(document.status)) {
    return (
      <p className="p-6 text-sm text-red-600">
        เอกสารฉบับร่างยังไม่สามารถส่งออกเป็น PDF ได้ กรุณาอนุมัติเอกสารก่อน
      </p>
    )
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
    <div className="mx-auto max-w-[210mm] bg-surface p-4 print:max-w-none print:bg-white print:p-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="print:hidden mb-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        พิมพ์ / บันทึกเป็น PDF
      </button>
      <DocumentPreview
        companyName={company.nameTh}
        companyAddress={company.address}
        companyTaxId={company.taxId}
        companyPhone={company.phone}
        logoUrl={company.logoUrl}
        logoSize={company.logoSize}
        logoPosition={company.logoPosition}
        template={company.documentTemplate}
        documentTypeLabel={resolveDocumentTypeLabel(document.documentType, company.templateTextOverrides)}
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
        templateTextOverrides={company.templateTextOverrides}
      />
    </div>
  )
}
