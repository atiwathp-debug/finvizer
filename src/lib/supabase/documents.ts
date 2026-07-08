import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  approveMockDraftDocument,
  cancelMockDocument,
  createMockDocumentConversion,
  createMockDocumentRevision,
  createMockDraftDocument,
  deleteMockDraftDocument,
  getMockDocumentById,
  listMockDocumentConversions,
  listMockDocumentRevisions,
  listMockDocumentsForCompany,
  markMockDocumentPaid,
  saveMockDocumentDraft,
  softDeleteMockDocument,
} from '@/lib/mock/mockDocuments'
import { calculateDocumentTotals, calculateInstallmentAmount } from '@/lib/calculations/documentTotals'
import { logError } from '@/lib/utils/debugLog'
import type { DocumentRow } from '@/types/database'
import type { DocumentRecord, DocumentType, LineItem } from '@/types/document'
import type { DocumentFormValues } from '@/lib/validations/document'
import type { Customer } from '@/types/customer'
import type { MemberRole } from '@/types/member'

interface DocumentItemRow {
  id: string
  document_id: string
  description: string
  quantity: number
  unit: string | null
  unit_price: number
  discount_type: LineItem['discountType']
  discount_value: number
  amount: number
  sort_order: number
}

function mapDocumentItemRow(row: DocumentItemRow): LineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    amount: row.amount,
    sortOrder: row.sort_order,
  }
}

function mapDocumentRow(row: DocumentRow, items: LineItem[] = []): DocumentRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    documentType: row.document_type,
    status: row.status,
    customerId: row.customer_id,
    customerCode: row.customer_code,
    documentNumber: row.document_number,
    vatMode: row.vat_mode,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    note: row.note,
    documentDiscountType: row.document_discount_type,
    documentDiscountValue: row.document_discount_value,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    vatAmount: row.vat_amount,
    grandTotal: row.grand_total,
    items,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    parentDocumentId: row.parent_document_id,
    revisionNo: row.revision_no,
    sourceDocumentId: row.source_document_id,
    installmentNumber: row.installment_number,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  }
}

/** No items included — this is a lightweight list view, not the full editing shape. */
export async function listDocuments(companyId: string): Promise<DocumentRecord[]> {
  if (isMockMode) return listMockDocumentsForCompany(companyId)

  try {
    const { data, error } = await requireSupabase()
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapDocumentRow(row))
  } catch (error) {
    logError('documents.listDocuments', error, { companyId })
    throw error
  }
}

/**
 * Fetches a document with its line items — two separate queries (not an
 * embedded `.select('*, document_items(*)')`) since this codebase's
 * hand-written Database type doesn't declare table Relationships, which
 * silently breaks postgrest-js's embedded-join typing — same reasoning
 * documented in src/lib/supabase/members.ts.
 */
export async function getDocumentById(documentId: string): Promise<DocumentRecord | null> {
  if (isMockMode) return getMockDocumentById(documentId)

  try {
    const client = requireSupabase()
    const { data: documentRow, error: documentError } = await client
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle()
    if (documentError) throw documentError
    if (!documentRow) return null

    const { data: itemRows, error: itemsError } = await client
      .from('document_items')
      .select('*')
      .eq('document_id', documentId)
      .order('sort_order')
    if (itemsError) throw itemsError

    return mapDocumentRow(documentRow, (itemRows ?? []).map(mapDocumentItemRow))
  } catch (error) {
    logError('documents.getDocumentById', error, { documentId })
    throw error
  }
}

/** Creates a Draft only — document_number stays null until approveDocument() (Phase 4B). */
export async function createDraftDocument(
  companyId: string,
  documentType: DocumentType,
  createdBy: string,
  customerCode?: string | null,
): Promise<DocumentRecord> {
  if (isMockMode) return createMockDraftDocument(companyId, documentType, createdBy, customerCode)

  try {
    const { data, error } = await requireSupabase()
      .from('documents')
      .insert({
        company_id: companyId,
        document_type: documentType,
        created_by: createdBy,
        customer_code: customerCode ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.createDraftDocument', error, { companyId, documentType })
    throw error
  }
}

/** Only Drafts can be deleted (documents_delete_draft_only RLS policy backs this up server-side too). */
export async function deleteDraftDocument(documentId: string): Promise<void> {
  if (isMockMode) return deleteMockDraftDocument(documentId)

  try {
    const { error } = await requireSupabase().from('documents').delete().eq('id', documentId)
    if (error) throw error
  } catch (error) {
    logError('documents.deleteDraftDocument', error, { documentId })
    throw error
  }
}

/**
 * Creates a new Draft (documentId = null) or saves changes to an existing
 * one — the full Phase 4A editing flow. Totals are computed client-side
 * via the shared calculation engine (no RPC needed here, unlike Phase
 * 2C's number generation: there's no atomic counter or collision risk,
 * just a plain calculation before an ordinary RLS-covered write).
 *
 * Real mode does two round trips (documents row, then document_items) —
 * not wrapped in a single transaction/RPC, since the master spec only
 * asked for "save with RLS", not atomicity guarantees for this action.
 * If the items write fails after the document write succeeds, the
 * document row itself is still valid (just temporarily missing its new
 * items) — a limitation worth revisiting if this becomes a real
 * reliability issue in practice.
 */
export async function saveDraftDocument(
  documentId: string | null,
  companyId: string,
  createdBy: string,
  input: DocumentFormValues,
  customer: Customer,
): Promise<DocumentRecord> {
  if (isMockMode) return saveMockDocumentDraft(documentId, companyId, createdBy, input, customer)

  try {
    const client = requireSupabase()
    const totals = calculateDocumentTotals({
      items: input.items,
      documentDiscountType: input.documentDiscountType,
      documentDiscountValue: input.documentDiscountValue,
      vatMode: input.vatMode,
    })

    const documentFields = {
      document_type: input.documentType,
      customer_id: customer.id,
      customer_code: customer.customerCode,
      vat_mode: input.vatMode,
      issue_date: input.issueDate,
      due_date: input.dueDate || null,
      note: input.note || null,
      document_discount_type: input.documentDiscountType,
      document_discount_value: input.documentDiscountValue,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      vat_amount: totals.vatAmount,
      grand_total: totals.grandTotal,
      installment_number: input.installmentNumber ?? null,
    }

    let savedDocumentRow: DocumentRow
    if (documentId === null) {
      const { data, error } = await client
        .from('documents')
        .insert({ company_id: companyId, created_by: createdBy, ...documentFields })
        .select()
        .single()
      if (error) throw error
      savedDocumentRow = data
    } else {
      const { data, error } = await client
        .from('documents')
        .update(documentFields)
        .eq('id', documentId)
        .select()
        .maybeSingle()
      if (error) throw error
      if (!data) {
        throw new Error('ไม่สามารถแก้ไขได้ เอกสารนี้อาจไม่ใช่ฉบับร่างแล้ว หรือคุณไม่มีสิทธิ์แก้ไข')
      }
      savedDocumentRow = data

      const { error: deleteItemsError } = await client
        .from('document_items')
        .delete()
        .eq('document_id', documentId)
      if (deleteItemsError) throw deleteItemsError

      const { error: deleteInstallmentsError } = await client
        .from('document_installments')
        .delete()
        .eq('document_id', documentId)
      if (deleteInstallmentsError) throw deleteInstallmentsError
    }

    let items: LineItem[] = []
    if (input.items.length > 0) {
      const { data: insertedItems, error: itemsError } = await client
        .from('document_items')
        .insert(
          input.items.map((item, index) => ({
            document_id: savedDocumentRow.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || null,
            unit_price: item.unitPrice,
            discount_type: item.discountType,
            discount_value: item.discountValue,
            amount: totals.itemAmounts[index],
            sort_order: index,
          })),
        )
        .select()
      if (itemsError) throw itemsError
      items = (insertedItems ?? []).map(mapDocumentItemRow)
    }

    if (input.installmentPlan === 'INSTALLMENT' && input.installments.length > 0) {
      const { error: installmentsError } = await client.from('document_installments').insert(
        input.installments.map((installment, index) => ({
          document_id: savedDocumentRow.id,
          installment_no: installment.installmentNo,
          amount_type: installment.amountType,
          amount_value: installment.amountValue,
          computed_amount: calculateInstallmentAmount(installment.amountType, installment.amountValue, totals.grandTotal),
          due_date: installment.dueDate || null,
          note: installment.note || null,
          sort_order: index,
        })),
      )
      if (installmentsError) throw installmentsError
    }

    return mapDocumentRow(savedDocumentRow, items)
  } catch (error) {
    logError('documents.saveDraftDocument', error, { documentId, companyId, input })
    throw error
  }
}

/**
 * Backend-safe official number generation (Phase 2C) — real mode calls the
 * `approve_document` RPC (security definer; see
 * supabase/migrations/20260707120000_document_numbering_generation.sql),
 * which atomically validates, increments the numbering sequence, renders
 * the pattern, retries on collision, and logs both
 * DOCUMENT_NUMBER_GENERATED and APPROVE_DOCUMENT audit events itself —
 * unlike other RPCs in this app, no separate client-side logAuditEvent
 * call is needed (or wanted — it would double-log in real mode). Mock
 * Mode mirrors the same validation/retry logic client-side and has no
 * persisted audit trail either way, matching existing Mock Mode
 * conventions.
 */
export async function approveDocument(documentId: string, approvedBy: string): Promise<DocumentRecord> {
  if (isMockMode) return approveMockDraftDocument(documentId, approvedBy)

  try {
    const { data, error } = await requireSupabase().rpc('approve_document', {
      p_document_id: documentId,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.approveDocument', error, { documentId })
    throw error
  }
}

/**
 * Backend-safe APPROVED -> PAID transition (Phase 4B) — real mode calls the
 * `mark_document_paid` RPC (security definer; see
 * supabase/migrations/20260710120000_document_status_actions.sql), which
 * self-logs a MARK_DOCUMENT_PAID audit event. Same "no separate client-side
 * logAuditEvent call" reasoning as approveDocument above. `actorId` is only
 * used by the Mock Mode branch (to self-log there too, Phase 6A) — the RPC
 * itself always uses `auth.uid()`, never a client-supplied id.
 */
export async function markDocumentPaid(documentId: string, actorId: string): Promise<DocumentRecord> {
  if (isMockMode) return markMockDocumentPaid(documentId, actorId)

  try {
    const { data, error } = await requireSupabase().rpc('mark_document_paid', {
      p_document_id: documentId,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.markDocumentPaid', error, { documentId })
    throw error
  }
}

/**
 * Backend-safe APPROVED -> CANCELLED transition (Phase 4B) — real mode
 * calls the `cancel_document` RPC, which self-logs a CANCEL_DOCUMENT audit
 * event. Same reasoning as markDocumentPaid above.
 */
export async function cancelDocument(documentId: string, actorId: string): Promise<DocumentRecord> {
  if (isMockMode) return cancelMockDocument(documentId, actorId)

  try {
    const { data, error } = await requireSupabase().rpc('cancel_document', {
      p_document_id: documentId,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.cancelDocument', error, { documentId })
    throw error
  }
}

/**
 * Creates a revision Draft from an APPROVED, non-revision document (Phase
 * 4C) — real mode calls the `create_document_revision` RPC (security
 * definer; see supabase/migrations/20260711120000_document_revisions.sql),
 * which copies customer, line items, VAT mode, note, due_date (payment
 * term), document type, and totals, and self-logs a
 * CREATE_DOCUMENT_REVISION audit event. Same "no separate client-side
 * logAuditEvent call" reasoning as approveDocument. The returned record
 * has no items — callers that need them should re-fetch via
 * getDocumentById() (the same pattern DocumentFormPage already uses when
 * loading any Draft for editing).
 */
export async function createDocumentRevision(documentId: string, createdBy: string): Promise<DocumentRecord> {
  if (isMockMode) return createMockDocumentRevision(documentId, createdBy)

  try {
    const { data, error } = await requireSupabase().rpc('create_document_revision', {
      p_document_id: documentId,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.createDocumentRevision', error, { documentId })
    throw error
  }
}

/** All revisions of a given original document, in creation order — powers the detail page's revision timeline. */
export async function listDocumentRevisions(originalDocumentId: string): Promise<DocumentRecord[]> {
  if (isMockMode) return listMockDocumentRevisions(originalDocumentId)

  try {
    const { data, error } = await requireSupabase()
      .from('documents')
      .select('*')
      .eq('parent_document_id', originalDocumentId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => mapDocumentRow(row))
  } catch (error) {
    logError('documents.listDocumentRevisions', error, { originalDocumentId })
    throw error
  }
}

/**
 * Creates a Draft of a *different* document_type from an APPROVED source
 * (Phase 6A) — e.g. converting an approved QUOTATION into a new INVOICE
 * Draft. Real mode calls the `create_document_conversion` RPC (security
 * definer; see supabase/migrations/20260712120000_document_conversion.sql),
 * which validates the conversion against documentConversionMap
 * server-side and self-logs a CONVERT_DOCUMENT audit event. Same
 * "no separate client-side logAuditEvent call" reasoning as
 * createDocumentRevision.
 */
export async function createDocumentConversion(
  documentId: string,
  targetType: DocumentType,
  createdBy: string,
): Promise<DocumentRecord> {
  if (isMockMode) return createMockDocumentConversion(documentId, targetType, createdBy)

  try {
    const { data, error } = await requireSupabase().rpc('create_document_conversion', {
      p_document_id: documentId,
      p_target_type: targetType,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.createDocumentConversion', error, { documentId, targetType })
    throw error
  }
}

/** Every document converted FROM a given source document, in creation order — powers the detail page's conversion history. */
export async function listDocumentConversions(sourceDocumentId: string): Promise<DocumentRecord[]> {
  if (isMockMode) return listMockDocumentConversions(sourceDocumentId)

  try {
    const { data, error } = await requireSupabase()
      .from('documents')
      .select('*')
      .eq('source_document_id', sourceDocumentId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => mapDocumentRow(row))
  } catch (error) {
    logError('documents.listDocumentConversions', error, { sourceDocumentId })
    throw error
  }
}

/**
 * Soft-deletes a document (Pass 5C-B) — sets deleted_at/deleted_by only,
 * never status/document_number/paid fields/conversion-or-revision lineage.
 * Real mode calls the `soft_delete_document` RPC (security definer; see
 * supabase/migrations/20260723120000_soft_delete_document_rpc.sql), which
 * re-validates role/status/type/conversion-forward eligibility server-side
 * and self-logs a SOFT_DELETE_DOCUMENT audit event — same "no separate
 * client-side logAuditEvent call" reasoning as approveDocument. `actorId`
 * and `currentUserRole` are only used by the Mock Mode branch (to
 * self-check eligibility and self-log there too, mirroring the RPC) — the
 * real RPC always derives both from auth.uid()/the caller's own company
 * membership, never a client-supplied value, same asymmetry as
 * markDocumentPaid's `actorId` parameter above. Does NOT replace
 * deleteDraftDocument — that hard-delete path (documents_delete_draft_only)
 * still backs the existing Draft-only delete button unchanged.
 */
export async function softDeleteDocument(
  documentId: string,
  actorId: string,
  currentUserRole: MemberRole | null,
): Promise<DocumentRecord> {
  if (isMockMode) return softDeleteMockDocument(documentId, actorId, currentUserRole)

  try {
    const { data, error } = await requireSupabase().rpc('soft_delete_document', {
      p_document_id: documentId,
    })
    if (error) throw error
    return mapDocumentRow(data)
  } catch (error) {
    logError('documents.softDeleteDocument', error, { documentId })
    throw error
  }
}
