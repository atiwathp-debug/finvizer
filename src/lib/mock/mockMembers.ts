import { findMockUserById } from '@/lib/mock/mockAuth'
import type { Member, MemberRole, MemberStatus } from '@/types/member'

const MEMBERS_KEY = 'finvizer_mock_company_members'

interface StoredMockMember {
  id: string
  companyId: string
  userId: string
  role: MemberRole
  status: MemberStatus
  createdAt: string
  updatedAt: string
}

function readMembers(): StoredMockMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY)
    return raw ? (JSON.parse(raw) as StoredMockMember[]) : []
  } catch {
    return []
  }
}

function writeMembers(members: StoredMockMember[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members))
}

/** The company (if any) and role the given user belongs to — mirrors the real unique(user_id) constraint. */
export function getMockMembershipForUser(
  userId: string,
): { companyId: string; role: MemberRole } | null {
  const member = readMembers().find((m) => m.userId === userId && m.status === 'ACTIVE')
  return member ? { companyId: member.companyId, role: member.role } : null
}

function toMember(stored: StoredMockMember): Member {
  const user = findMockUserById(stored.userId)
  return {
    id: stored.id,
    userId: stored.userId,
    email: user?.email ?? 'ไม่พบผู้ใช้',
    displayName: user?.displayName ?? 'ไม่พบผู้ใช้',
    role: stored.role,
    status: stored.status,
    createdAt: stored.createdAt,
  }
}

export function getMockMembersForCompany(companyId: string): Member[] {
  return readMembers()
    .filter((m) => m.companyId === companyId)
    .map(toMember)
}

export function countActiveNonOwnerMembers(companyId: string): number {
  return readMembers().filter(
    (m) => m.companyId === companyId && m.status === 'ACTIVE' && m.role !== 'OWNER',
  ).length
}

/** Bootstraps the OWNER row when a company is created — see mockCompany.ts. */
export function addMockMember(companyId: string, userId: string, role: MemberRole): void {
  if (getMockMembershipForUser(userId)) {
    throw new Error('ผู้ใช้นี้เป็นสมาชิกของบริษัทอื่นอยู่แล้ว')
  }
  const now = new Date().toISOString()
  const member: StoredMockMember = {
    id: crypto.randomUUID(),
    companyId,
    userId,
    role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }
  writeMembers([...readMembers(), member])
}

export function updateMockMemberRole(memberId: string, role: MemberRole): void {
  const members = readMembers()
  const index = members.findIndex((m) => m.id === memberId)
  if (index === -1) throw new Error('ไม่พบสมาชิกนี้')
  if (members[index].role === 'OWNER') {
    throw new Error('ไม่สามารถเปลี่ยนสิทธิ์ของเจ้าของบริษัทได้')
  }
  members[index] = { ...members[index], role, updatedAt: new Date().toISOString() }
  writeMembers(members)
}

export function removeMockMember(memberId: string): void {
  const members = readMembers()
  const target = members.find((m) => m.id === memberId)
  if (!target) throw new Error('ไม่พบสมาชิกนี้')
  if (target.role === 'OWNER') {
    throw new Error('ไม่สามารถลบเจ้าของบริษัทได้')
  }
  writeMembers(members.filter((m) => m.id !== memberId))
}

/**
 * Used by lib/mock/mockAccount.ts for a non-owner deleting their own
 * account — unlike removeMockMember, this allows removing an OWNER row too
 * (the owner path deletes their own membership as part of deleting the
 * whole company, via removeAllMockMembersForCompany below, not this one).
 */
export function removeMockMemberByUserId(userId: string): void {
  writeMembers(readMembers().filter((m) => m.userId !== userId))
}

/** Used by lib/mock/mockAccount.ts when the OWNER deletes their account — revokes every member's access. */
export function removeAllMockMembersForCompany(companyId: string): void {
  writeMembers(readMembers().filter((m) => m.companyId !== companyId))
}
