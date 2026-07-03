import type { MemberRole } from '@/types/member'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'

export interface Invitation {
  id: string
  companyId: string
  invitedEmail: string
  invitedRole: MemberRole
  invitedBy: string
  status: InvitationStatus
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  PENDING: 'รอตอบรับ',
  ACCEPTED: 'ตอบรับแล้ว',
  EXPIRED: 'หมดอายุ',
  CANCELLED: 'ยกเลิกแล้ว',
}
