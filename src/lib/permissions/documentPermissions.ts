import type { DocumentStatus, DocumentType } from '@/types/document'
import type { MemberRole } from '@/types/member'

const APPROVER_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT']
const EDITOR_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']
/** Only these document types represent money actually collected — see mark_document_paid() in supabase/migrations/20260713120000_paid_cascade.sql. */
const PAYABLE_DOCUMENT_TYPES: DocumentType[] = ['RECEIPT', 'RECEIPT_TAX_INVOICE']

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
