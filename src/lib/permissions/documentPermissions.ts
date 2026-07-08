import type { DocumentStatus, DocumentType } from '@/types/document'
import type { MemberRole } from '@/types/member'

const APPROVER_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT']
const EDITOR_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']
/** Only these document types represent money actually collected — see mark_document_paid() in supabase/migrations/20260713120000_paid_cascade.sql. */
const PAYABLE_DOCUMENT_TYPES: DocumentType[] = ['RECEIPT', 'RECEIPT_TAX_INVOICE']
/**
 * Only these two roles may delete a converted RFQ/QUOTATION or any
 * financial chain document (Pass 5C-A design) — deliberately narrower than
 * APPROVER_ROLES: ADMIN is excluded here. No mapping anywhere in this
 * codebase treats ADMIN as OWNER-equivalent (company ownership is
 * `companies.owner_id`, entirely separate from `company_members.role` —
 * see is_company_owner() in supabase/migrations/20260702120300_rls_helper_functions.sql),
 * so ADMIN stays limited to Draft and not-yet-converted RFQ/QUOTATION only.
 */
const CHAIN_DELETE_ROLES: MemberRole[] = ['OWNER', 'ACCOUNTANT']
/** RFQ/QUOTATION are source/pre-quotation documents (Pass 5C-A) — everything else in DocumentType is a financial chain document for delete-permission purposes. */
const SOURCE_TIER_DOCUMENT_TYPES: DocumentType[] = ['RFQ', 'QUOTATION']

/**
 * OWNER/ADMIN/ACCOUNTANT can approve a Draft, mark an Approved document as
 * Paid, or cancel one — EDITOR and VIEWER cannot. Mirrors the role check
 * inside approve_document()/mark_document_paid()/cancel_document() (see
 * supabase/migrations/20260707120000_document_numbering_generation.sql and
 * 20260710120000_document_status_actions.sql) — kept as a pure function
 * (not just an inline useHasCompanyRole([...]) call) so the rule itself is
 * unit-testable independent of React/Zustand.
 */
export function canApproveDocument(role: MemberRole | null): boolean {
  return role !== null && APPROVER_ROLES.includes(role)
}

/** OWNER/ADMIN/ACCOUNTANT/EDITOR can create or edit a Draft document — VIEWER cannot. */
export function canEditDocument(role: MemberRole | null): boolean {
  return role !== null && EDITOR_ROLES.includes(role)
}

/**
 * "Mark as Paid" is only available on an APPROVED RECEIPT or
 * RECEIPT_TAX_INVOICE — those are the only document types that represent
 * money actually collected. Quotations, invoices (still unpaid), tax
 * invoices, and credit notes must never be marked paid directly; marking a
 * receipt paid cascades PAID through its document chain instead (see
 * markMockDocumentPaid / mark_document_paid()).
 */
export function canMarkDocumentPaid(
  documentType: DocumentType,
  status: DocumentStatus,
  role: MemberRole | null,
): boolean {
  return canApproveDocument(role) && status === 'APPROVED' && PAYABLE_DOCUMENT_TYPES.includes(documentType)
}

/**
 * PDF export (the "ส่งออก PDF" button and the `/documents/:id/print` route)
 * is only meaningful once a document has an official document number —
 * that only ever happens on/after approval (see the `documentNumber`
 * comment in src/types/document.ts). A DRAFT has no number and its content
 * can still change freely, so exporting one to PDF would produce a
 * document that looks final but isn't — every other status (APPROVED,
 * PAID, CANCELLED) already has a number and unchanging content, so export
 * stays allowed for all of them.
 */
export function canExportDocumentPdf(status: DocumentStatus): boolean {
  return status !== 'DRAFT'
}

/**
 * Soft-delete eligibility (Pass 5C-A/5C-B design, mirrors the role/status/
 * type/chain checks inside soft_delete_document() — see
 * supabase/migrations/20260723120000_soft_delete_document_rpc.sql — so the
 * UI never offers a delete action the RPC would just reject):
 *
 * - VIEWER can never delete anything.
 * - An already soft-deleted document can never be deleted again.
 * - A PAID document can never be deleted, regardless of role or type — a
 *   financial chain document is the only type that ever reaches PAID
 *   (mark_document_paid()'s cascade), so this only actually applies there,
 *   but the check runs before any type/role branching so it can't be
 *   bypassed by either.
 * - DRAFT (any document type): any non-VIEWER role.
 * - RFQ/QUOTATION not yet converted forward (`hasBeenConvertedForward`,
 *   computed by the caller the same way trackQuotationStatuses() does —
 *   documents.some(d => d.sourceDocumentId === thisDocument.id)): any
 *   non-VIEWER role.
 * - RFQ/QUOTATION already converted forward, or any other (financial
 *   chain) document type that isn't PAID: OWNER/ACCOUNTANT only.
 */
export function canDeleteDocument(
  documentType: DocumentType,
  status: DocumentStatus,
  deletedAt: string | null,
  hasBeenConvertedForward: boolean,
  role: MemberRole | null,
): boolean {
  if (role === null || role === 'VIEWER') return false
  if (deletedAt !== null) return false
  if (status === 'PAID') return false
  if (status === 'DRAFT') return canEditDocument(role)

  if (SOURCE_TIER_DOCUMENT_TYPES.includes(documentType)) {
    return hasBeenConvertedForward ? CHAIN_DELETE_ROLES.includes(role) : canEditDocument(role)
  }
  return CHAIN_DELETE_ROLES.includes(role)
}
