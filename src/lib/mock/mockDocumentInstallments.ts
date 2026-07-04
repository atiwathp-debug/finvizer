import type { DocumentInstallment } from '@/types/documentInstallment'

const DOCUMENT_INSTALLMENTS_KEY = 'finvizer_mock_document_installments'

function readInstallments(): DocumentInstallment[] {
  try {
    const raw = localStorage.getItem(DOCUMENT_INSTALLMENTS_KEY)
    return raw ? (JSON.parse(raw) as DocumentInstallment[]) : []
  } catch {
    return []
  }
}

function writeInstallments(installments: DocumentInstallment[]) {
  localStorage.setItem(DOCUMENT_INSTALLMENTS_KEY, JSON.stringify(installments))
}

/** All installment rows for a document, in sort order — used by the preview/PDF and the convert-dialog installment picker. */
export function listMockDocumentInstallments(documentId: string): DocumentInstallment[] {
  return readInstallments()
    .filter((installment) => installment.documentId === documentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Full delete-then-reinsert for a document's installment rows — same
 * tradeoff already accepted for document_items (two "round trips" instead
 * of diffing). Called only from saveMockDocumentDraft, never standalone.
 */
export function saveMockDocumentInstallments(
  documentId: string,
  installments: DocumentInstallment[],
): DocumentInstallment[] {
  const others = readInstallments().filter((installment) => installment.documentId !== documentId)
  writeInstallments([...others, ...installments])
  return installments
}
