import type { DocumentRecord } from '@/types/document'

/**
 * Suggested filename for this document, e.g. "ใบเสนอราคา-QO-2026-0001.pdf"
 * or "ใบเสนอราคา-DRAFT.pdf" for an unapproved document. Used as the print
 * page's document.title, which the browser's own "Save as PDF" dialog
 * offers as the default filename — no PDF library involved.
 */
export function documentPdfFileName(document: DocumentRecord, documentTypeLabel: string): string {
  const suffix = document.documentNumber ?? 'DRAFT'
  return `${documentTypeLabel}-${suffix}.pdf`
}
