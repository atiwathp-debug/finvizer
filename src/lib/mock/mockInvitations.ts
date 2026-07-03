import { addMockMember, countActiveNonOwnerMembers, getMockMembershipForUser } from '@/lib/mock/mockMembers'
import { getMockCompanyById } from '@/lib/mock/mockCompany'
import type { AuthUser } from '@/types/auth'
import type { Company } from '@/types/company'
import type { Invitation, InvitationStatus } from '@/types/invitation'
import type { MemberRole } from '@/types/member'

const INVITATIONS_KEY = 'finvizer_mock_invitations'
const MAX_INVITED_EMAILS = 2
const EXPIRY_DAYS = 7

interface StoredMockInvitation extends Invitation {
  tokenHash: string
}

function readInvitations(): StoredMockInvitation[] {
  try {
    const raw = localStorage.getItem(INVITATIONS_KEY)
    return raw ? (JSON.parse(raw) as StoredMockInvitation[]) : []
  } catch {
    return []
  }
}

function writeInvitations(invitations: StoredMockInvitation[]) {
  localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations))
}

function stripTokenHash(stored: StoredMockInvitation): Invitation {
  const { tokenHash: _tokenHash, ...invitation } = stored
  return invitation
}

export function listMockInvitations(companyId: string): Invitation[] {
  return readInvitations()
    .filter((i) => i.companyId === companyId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(stripTokenHash)
}

export function createMockInvitation(
  companyId: string,
  invitedEmail: string,
  invitedRole: MemberRole,
  invitedBy: string,
  tokenHash: string,
): Invitation {
  const normalizedEmail = invitedEmail.trim().toLowerCase()
  const existing = readInvitations()

  const hasPendingForEmail = existing.some(
    (i) => i.companyId === companyId && i.invitedEmail === normalizedEmail && i.status === 'PENDING',
  )
  if (hasPendingForEmail) {
    throw new Error('มีคำเชิญที่ค้างอยู่สำหรับอีเมลนี้แล้ว')
  }

  const pendingCount = existing.filter(
    (i) => i.companyId === companyId && i.status === 'PENDING',
  ).length
  if (countActiveNonOwnerMembers(companyId) + pendingCount >= MAX_INVITED_EMAILS) {
    throw new Error('คุณเชิญผู้ใช้งานครบจำนวนสูงสุดแล้ว (2 อีเมล)')
  }

  const now = new Date()
  const invitation: StoredMockInvitation = {
    id: crypto.randomUUID(),
    companyId,
    invitedEmail: normalizedEmail,
    invitedRole,
    invitedBy,
    status: 'PENDING',
    expiresAt: new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    acceptedAt: null,
    tokenHash,
  }
  writeInvitations([...existing, invitation])
  return stripTokenHash(invitation)
}

function setInvitationStatus(id: string, status: InvitationStatus, acceptedAt?: string) {
  const invitations = readInvitations()
  const index = invitations.findIndex((i) => i.id === id)
  if (index === -1) return
  invitations[index] = { ...invitations[index], status, acceptedAt: acceptedAt ?? invitations[index].acceptedAt }
  writeInvitations(invitations)
}

/** Used by lib/mock/mockAccount.ts when the OWNER deletes their account. */
export function deleteAllMockInvitationsForCompany(companyId: string): void {
  writeInvitations(readInvitations().filter((i) => i.companyId !== companyId))
}

export function cancelMockInvitation(invitationId: string): void {
  const invitation = readInvitations().find((i) => i.id === invitationId)
  if (!invitation) throw new Error('ไม่พบคำเชิญนี้')
  if (invitation.status !== 'PENDING') throw new Error('คำเชิญนี้ไม่ได้อยู่ในสถานะรอตอบรับ')
  setInvitationStatus(invitationId, 'CANCELLED')
}

export function acceptMockInvitation(tokenHash: string, currentUser: AuthUser): Company {
  const invitation = readInvitations().find((i) => i.tokenHash === tokenHash && i.status === 'PENDING')
  if (!invitation) {
    throw new Error('ลิงก์คำเชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว')
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    setInvitationStatus(invitation.id, 'EXPIRED')
    throw new Error('ลิงก์คำเชิญหมดอายุแล้ว')
  }

  if (currentUser.email.trim().toLowerCase() !== invitation.invitedEmail) {
    throw new Error('อีเมลของคุณไม่ตรงกับอีเมลที่ได้รับคำเชิญ')
  }

  if (getMockMembershipForUser(currentUser.id)) {
    throw new Error('คุณเป็นสมาชิกของบริษัทอื่นอยู่แล้ว ไม่สามารถเข้าร่วมบริษัทนี้ได้')
  }

  addMockMember(invitation.companyId, currentUser.id, invitation.invitedRole)
  setInvitationStatus(invitation.id, 'ACCEPTED', new Date().toISOString())

  const company = getMockCompanyById(invitation.companyId)
  if (!company) throw new Error('ไม่พบบริษัท')
  return company
}
