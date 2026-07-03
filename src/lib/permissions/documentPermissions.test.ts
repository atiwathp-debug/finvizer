import { describe, expect, it } from 'vitest'
import { canApproveDocument, canEditDocument } from './documentPermissions'
import type { MemberRole } from '@/types/member'

describe('canApproveDocument', () => {
  it.each<MemberRole>(['OWNER', 'ADMIN', 'ACCOUNTANT'])('allows %s to approve/mark paid/cancel', (role) => {
    expect(canApproveDocument(role)).toBe(true)
  })

  it('does not allow EDITOR to approve', () => {
    expect(canApproveDocument('EDITOR')).toBe(false)
  })

  it('does not allow VIEWER to approve', () => {
    expect(canApproveDocument('VIEWER')).toBe(false)
  })

  it('does not allow a user with no membership in the company', () => {
    expect(canApproveDocument(null)).toBe(false)
  })

  // Revision approval (Phase 4C) reuses this exact function — approving a
  // revision Draft is just approveDocument() on a row that happens to have
  // parent_document_id set, gated by the same "อนุมัติเอกสาร" button/check.
  it('does not allow EDITOR to approve a revision', () => {
    expect(canApproveDocument('EDITOR')).toBe(false)
  })
})

describe('canEditDocument', () => {
  it.each<MemberRole>(['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR'])('allows %s to create/edit a Draft', (role) => {
    expect(canEditDocument(role)).toBe(true)
  })

  it('does not allow VIEWER to edit', () => {
    expect(canEditDocument('VIEWER')).toBe(false)
  })

  it('does not allow a user with no membership in the company', () => {
    expect(canEditDocument(null)).toBe(false)
  })

  // "สร้าง Revision" (Phase 4C) and editing the resulting revision Draft
  // both reuse this exact function — a revision Draft is an ordinary Draft
  // row as far as permissions are concerned.
  it('does not allow VIEWER to create or edit a revision Draft', () => {
    expect(canEditDocument('VIEWER')).toBe(false)
  })
})
