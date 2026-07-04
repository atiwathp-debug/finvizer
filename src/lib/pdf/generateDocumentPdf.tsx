import { pdf } from '@react-pdf/renderer'
import { DocumentPdf } from '@/lib/pdf/DocumentPdf'
import { withSignatureFallback } from '@/lib/signatures/defaultSignatureSlots'
import type { DocumentRecord } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'
import type { SignatureSlot } from '@/types/signature'
import type { DocumentInstallment } from '@/types/documentInstallment'

interface GenerateDocumentPdfInput {
  company: Company
  customer: Customer | null
  document: DocumentRecord
  /** Company's configured signature slots — falls back to ผู้ซื้อ/ผู้ขาย when omitted or empty. */
  signatureSlots?: SignatureSlot[]
  /** This document's installment payment plan, if any — renders an extra table when non-empty. */
  installments?: DocumentInstallment[]
}

/**
 * Renders a document to a PDF Blob entirely client-side — no network
 * call, no upload to Supabase Storage or anywhere else. The caller is
 * responsible for turning the Blob into a local download (see
 * DocumentDetailPage's handleExportPdf); this function never persists or
 * transmits the result.
 */
export async function generateDocumentPdf({
  company,
  customer,
  document,
  signatureSlots,
  installments,
}: GenerateDocumentPdfInput): Promise<Blob> {
  const template = company.documentTemplate ?? 'EXECUTIVE_CLASSIC'
  const instance = pdf(
    <DocumentPdf
      company={company}
      customer={customer}
      document={document}
      template={template}
      signatureSlots={withSignatureFallback(signatureSlots ?? [])}
      installments={installments ?? []}
    />,
  )
  return instance.toBlob()
}

/** e.g. "ใบเสนอราคา-QO-2026-0001.pdf" or "ใบเสนอราคา-DRAFT.pdf" for an unapproved document. */
export function documentPdfFileName(document: DocumentRecord, documentTypeLabel: string): string {
  const suffix = document.documentNumber ?? 'DRAFT'
  return `${documentTypeLabel}-${suffix}.pdf`
}
