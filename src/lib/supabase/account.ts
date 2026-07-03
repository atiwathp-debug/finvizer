import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import { getCompanyMembers } from '@/lib/supabase/members'
import { listInvitations } from '@/lib/supabase/invitations'
import { listCustomers } from '@/lib/supabase/customers'
import { listDocuments } from '@/lib/supabase/documents'
import { deleteMockAccount } from '@/lib/mock/mockAccount'
import { getMockMembersForCompany } from '@/lib/mock/mockMembers'
import { listMockInvitations } from '@/lib/mock/mockInvitations'
import { mockAuditLogs, type MockAuditLog } from '@/lib/mock/auditLogs'
import { logError } from '@/lib/utils/debugLog'
import type { AuthUser } from '@/types/auth'
import type { Company } from '@/types/company'
import type { Member, MemberRole } from '@/types/member'
import type { Invitation } from '@/types/invitation'
import type { Customer } from '@/types/customer'
import type { DocumentRecord } from '@/types/document'

export interface AccountExportPayload {
  exportedAt: string
  mode: 'mock' | 'real'
  profile: { id: string; email: string; displayName: string }
  role: MemberRole
  company: Company
  members: Member[]
  invitations: Invitation[]
  /**
   * Raw audit_logs rows in real mode (already scoped to this company by
   * RLS); the static Thai demo trail in Mock Mode, since Settings > Audit
   * Log itself still shows that same static data rather than the real
   * persisted Mock Mode audit trail added in Phase 6A (see
   * lib/mock/mockAuditLogs.ts) — kept consistent with what the user
   * actually sees on that page.
   */
  auditLogs: MockAuditLog[] | Record<string, unknown>[]
  customers: Customer[]
  documents: DocumentRecord[]
  notes: string[]
}

/**
 * Gathers everything the signed-in user is allowed to read about their
 * account/company into one JSON-serializable payload — used by the
 * Settings > Privacy & Data "Export ข้อมูลเป็น JSON" button.
 *
 * Every real-mode read goes through the same RLS-scoped client the rest of
 * the app uses (no service_role, no Edge Function) — this is a read of
 * data the user can already see, not a privileged operation.
 *
 * customers/documents use the same listCustomers()/listDocuments() the
 * rest of the app calls, so both modes export the user's actual saved
 * data — not Phase 0B's static demo fixtures, which is what this export
 * incorrectly used in Mock Mode (and omitted entirely in real mode)
 * before the customers/documents tables existed.
 */
export async function exportAccountData(
  user: AuthUser,
  company: Company,
  role: MemberRole,
): Promise<AccountExportPayload> {
  if (isMockMode) {
    const [customers, documents] = await Promise.all([listCustomers(company.id), listDocuments(company.id)])
    return {
      exportedAt: new Date().toISOString(),
      mode: 'mock',
      profile: { id: user.id, email: user.email, displayName: user.displayName },
      role,
      company,
      members: getMockMembersForCompany(company.id),
      invitations: role === 'OWNER' ? listMockInvitations(company.id) : [],
      auditLogs: mockAuditLogs,
      customers,
      documents,
      notes: [
        'ไฟล์นี้เป็นข้อมูลตัวอย่าง (Mock Mode) — ยังไม่ได้เชื่อมต่อ Supabase จริง',
      ],
    }
  }

  try {
    const client = requireSupabase()
    const [profileResult, members, invitations, auditResult, customers, documents] = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).single(),
      getCompanyMembers(company.id),
      listInvitations(company.id),
      client
        .from('audit_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      listCustomers(company.id),
      listDocuments(company.id),
    ])
    if (profileResult.error) throw profileResult.error
    if (auditResult.error) throw auditResult.error

    const notes: string[] = []
    if (role !== 'OWNER') {
      notes.push('คุณไม่ใช่เจ้าของบริษัท จึงไม่รวมรายการคำเชิญ (invitations) ซึ่งมีเฉพาะเจ้าของบริษัทเท่านั้นที่ดูได้')
    }

    return {
      exportedAt: new Date().toISOString(),
      mode: 'real',
      profile: {
        id: profileResult.data.id,
        email: profileResult.data.email,
        displayName: profileResult.data.display_name,
      },
      role,
      company,
      members,
      invitations,
      auditLogs: auditResult.data ?? [],
      customers,
      documents,
      notes,
    }
  } catch (error) {
    logError('account.exportAccountData', error, { userId: user.id, companyId: company.id })
    throw error
  }
}

/**
 * Mock Mode: deletes the local user/company/member/invitation records
 * directly (see lib/mock/mockAccount.ts). Real mode: invokes the
 * delete-account Edge Function, which alone holds the service_role key
 * needed to hard-delete the auth.users row — see
 * supabase/functions/delete-account/index.ts.
 */
export async function deleteAccount(user: AuthUser): Promise<void> {
  if (isMockMode) {
    deleteMockAccount(user.id)
    return
  }

  try {
    const { error } = await requireSupabase().functions.invoke('delete-account')
    if (error) throw error
  } catch (error) {
    logError('account.deleteAccount', error, { userId: user.id })
    throw error
  }
}
