import type { MemberRole } from '@/types/member'

const APPROVER_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT']
const EDITOR_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']

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
