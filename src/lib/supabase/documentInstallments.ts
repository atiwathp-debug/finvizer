import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import { listMockDocumentInstallments } from '@/lib/mock/mockDocumentInstallments'
import { logError } from '@/lib/utils/debugLog'
import type { DocumentInstallment, InstallmentAmountType } from '@/types/documentInstallment'

interface DocumentInstallmentRow {
  id: string
  document_id: string
  installment_no: number
  amount_type: InstallmentAmountType
  amount_value: number
  computed_amount: number
  due_date: string | null
  note: string | null
  sort_order: number
}

export function mapDocumentInstallmentRow(row: DocumentInstallmentRow): DocumentInstallment {
  return {
    id: row.id,
    documentId: row.document_id,
    installmentNo: row.installment_no,
    amountType: row.amount_type,
    amountValue: row.amount_value,
    computedAmount: row.computed_amount,
    dueDate: row.due_date,
    note: row.note,
    sortOrder: row.sort_order,
  }
}

/** All installment rows for a document, in sort order — used by the preview/PDF and the convert-dialog installment picker. */
export async function listDocumentInstallments(documentId: string): Promise<DocumentInstallment[]> {
  if (isMockMode) return listMockDocumentInstallments(documentId)

  try {
    const { data, error } = await requireSupabase()
      .from('document_installments')
      .select('*')
      .eq('document_id', documentId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []).map(mapDocumentInstallmentRow)
  } catch (error) {
    logError('documentInstallments.listDocumentInstallments', error, { documentId })
    throw error
  }
}
