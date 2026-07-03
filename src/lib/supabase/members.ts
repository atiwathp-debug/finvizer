import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  getMockMembersForCompany,
  removeMockMember,
  updateMockMemberRole,
} from '@/lib/mock/mockMembers'
import { logError } from '@/lib/utils/debugLog'
import type { Member, MemberRole } from '@/types/member'

export async function getCompanyMembers(companyId: string): Promise<Member[]> {
  if (isMockMode) return getMockMembersForCompany(companyId)

  try {
    const client = requireSupabase()
    const { data: memberRows, error: membersError } = await client
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
    if (membersError) throw membersError
    if (!memberRows || memberRows.length === 0) return []

    const userIds = memberRows.map((row) => row.user_id)
    const { data: profileRows, error: profilesError } = await client
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds)
    if (profilesError) throw profilesError

    const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))
    return memberRows.map((row) => {
      const profile = profileById.get(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        email: profile?.email ?? 'ไม่พบผู้ใช้',
        displayName: profile?.display_name ?? 'ไม่พบผู้ใช้',
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
      }
    })
  } catch (error) {
    logError('members.getCompanyMembers', error, { companyId })
    throw error
  }
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
  if (isMockMode) return updateMockMemberRole(memberId, role)

  try {
    const { error } = await requireSupabase()
      .from('company_members')
      .update({ role })
      .eq('id', memberId)
    if (error) throw error
  } catch (error) {
    logError('members.updateMemberRole', error, { memberId, role })
    throw error
  }
}

export async function removeMember(memberId: string): Promise<void> {
  if (isMockMode) return removeMockMember(memberId)

  try {
    const { error } = await requireSupabase().from('company_members').delete().eq('id', memberId)
    if (error) throw error
  } catch (error) {
    logError('members.removeMember', error, { memberId })
    throw error
  }
}
