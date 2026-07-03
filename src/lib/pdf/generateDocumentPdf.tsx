import { pdf } from '@react-pdf/renderer'
import { DocumentPdf } from '@/lib/pdf/DocumentPdf'
import type { DocumentRecord } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'

interface GenerateDocumentPdfInput {
  company: Company
  customer: Customer | null
  document: DocumentRecord
}

/**
 * Renders a document to a PDF Blob entirely client-side — no network
 * call, no upload to Supabase Storage or anywhere else. The caller is
 * responsible for turning the Blob into a local download (see
 * DocumentDetailPage's handleExportPdf); this function never persists or
 * transmits the result.
 */
export async function generateDocumentPdf({ company, customer, document }: GenerateDocumentPdfInput): Promise<Blob> {
  const template = company.documentTemplate ?? 'EXECUTIVE_CLASSIC'
  const instance = pdf(<DocumentPdf company={company} customer={customer} document={document} template={template} />)
  return instance.toBlob()
}

/** e.g. "ใบเสนอราคา-QO-2026-0001.pdf" or "ใบเสนอราคา-DRAFT.pdf" for an unapproved document. */
export function documentPdfFileName(document: DocumentRecord, documentTypeLabel: string): string {
  const suffix = document.documentNumber ?? 'DRAFT'
  return `${documentTypeLabel}-${suffix}.pdf`
}
