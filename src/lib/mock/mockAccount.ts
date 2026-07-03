import { deleteMockUser } from '@/lib/mock/mockAuth'
import { deleteMockCompany } from '@/lib/mock/mockCompany'
import {
  getMockMembershipForUser,
  removeAllMockMembersForCompany,
  removeMockMemberByUserId,
} from '@/lib/mock/mockMembers'
import { deleteAllMockInvitationsForCompany } from '@/lib/mock/mockInvitations'

/**
 * Mock Mode equivalent of the supabase/functions/delete-account Edge
 * Function: OWNER deletion removes the company and every member's access;
 * non-owner deletion only removes their own membership. Mock Mode has no
 * separate auth.users table to preserve for audit purposes, so — unlike
 * the real Edge Function, which soft-deletes the company — this just
 * removes everything for the deleted user's company outright.
 */
export function deleteMockAccount(userId: string): void {
  const membership = getMockMembershipForUser(userId)
  if (membership) {
    if (membership.role === 'OWNER') {
      removeAllMockMembersForCompany(membership.companyId)
      deleteAllMockInvitationsForCompany(membership.companyId)
      deleteMockCompany(membership.companyId)
    } else {
      removeMockMemberByUserId(userId)
    }
  }
  deleteMockUser(userId)
}
