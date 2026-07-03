export type MemberRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'EDITOR' | 'VIEWER'
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'DISABLED'

export const roleLabels: Record<MemberRole, string> = {
  OWNER: 'เจ้าของบริษัท',
  ADMIN: 'ผู้ดูแลระบบ',
  ACCOUNTANT: 'ฝ่ายบัญชี',
  EDITOR: 'ผู้แก้ไขเอกสาร',
  VIEWER: 'ผู้ดูอย่างเดียว',
}

export const memberStatusLabels: Record<MemberStatus, string> = {
  ACTIVE: 'ใช้งานอยู่',
  INVITED: 'รอยืนยัน',
  DISABLED: 'ปิดใช้งาน',
}

/** Roles that can be assigned to an invited/existing member. OWNER is set once, at company creation. */
export const assignableMemberRoles: MemberRole[] = ['ADMIN', 'ACCOUNTANT', 'EDITOR', 'VIEWER']

export interface Member {
  id: string
  userId: string
  email: string
  displayName: string
  role: MemberRole
  status: MemberStatus
  createdAt: string
}
