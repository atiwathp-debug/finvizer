import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import { mapCompanyRow } from '@/lib/supabase/company'
import {
  acceptMockInvitation,
  cancelMockInvitation,
  createMockInvitation,
  listMockInvitations,
} from '@/lib/mock/mockInvitations'
import { generateInviteToken, hashInviteToken } from '@/lib/utils/inviteToken'
import { buildAppUrl } from '@/lib/utils/url'
import { logError } from '@/lib/utils/debugLog'
import type { AuthUser } from '@/types/auth'
import type { Company } from '@/types/company'
import type { Invitation, InvitationStatus } from '@/types/invitation'
import type { MemberRole } from '@/types/member'

const INVITE_EXPIRY_DAYS = 7

function mapInvitationRow(row: {
  id: string
  company_id: string
  invited_email: string
  invited_role: MemberRole
  invited_by: string
  status: InvitationStatus
  expires_at: string
  created_at: string
  accepted_at: string | null
}): Invitation {
  return {
    id: row.id,
    companyId: row.company_id,
    invitedEmail: row.invited_email,
    invitedRole: row.invited_role,
    invitedBy: row.invited_by,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  }
}

export interface CreateInvitationResult {
  invitation: Invitation
  inviteUrl: string
}

/**
 * Generates a random token client-side, hashes it, and persists only the
 * hash — the raw token only ever exists in this function's return value
 * (for the Owner to copy) and is never sent anywhere else or logged.
 */
export async function createInvitation(
  companyId: string,
  invitedEmail: string,
  invitedRole: MemberRole,
  invitedBy: string,
): Promise<CreateInvitationResult> {
  const token = generateInviteToken()
  const tokenHash = await hashInviteToken(token)
  const normalizedEmail = invitedEmail.trim().toLowerCase()

  let invitation: Invitation
  if (isMockMode) {
    invitation = createMockInvitation(companyId, normalizedEmail, invitedRole, invitedBy, tokenHash)
  } else {
    try {
      const { data, error } = await requireSupabase()
        .from('invitations')
        .insert({
          company_id: companyId,
          invited_email: normalizedEmail,
          invited_role: invitedRole,
          invited_by: invitedBy,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      invitation = mapInvitationRow(data)
    } catch (error) {
      logError('invitations.createInvitation', error, { companyId, invitedEmail: normalizedEmail })
      throw error
    }
  }

  return { invitation, inviteUrl: buildAppUrl(`invite/${token}`) }
}

export async function listInvitations(companyId: string): Promise<Invitation[]> {
  if (isMockMode) return listMockInvitations(companyId)

  try {
    const { data, error } = await requireSupabase()
      .from('invitations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapInvitationRow)
  } catch (error) {
    logError('invitations.listInvitations', error, { companyId })
    throw error
  }
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  if (isMockMode) return cancelMockInvitation(invitationId)

  try {
    const { error } = await requireSupabase()
      .from('invitations')
      .update({ status: 'CANCELLED' })
      .eq('id', invitationId)
    if (error) throw error
  } catch (error) {
    logError('invitations.cancelInvitation', error, { invitationId })
    throw error
  }
}

/** `rawToken` is the value from the /invite/:token URL — hashed here before ever touching the network. */
export async function acceptInvitation(rawToken: string, currentUser: AuthUser): Promise<Company> {
  const tokenHash = await hashInviteToken(rawToken)

  if (isMockMode) return acceptMockInvitation(tokenHash, currentUser)

  try {
    const { data, error } = await requireSupabase().rpc('accept_invitation', {
      p_token_hash: tokenHash,
    })
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('invitations.acceptInvitation', error, { tokenHash })
    throw error
  }
}
