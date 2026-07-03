/**
 * A single audit trail entry — shape mirrors the `audit_logs` table
 * (Phase 1B) exactly, camelCased. Distinct from `MockAuditLog` in
 * lib/mock/auditLogs.ts, which is Phase 0B's hardcoded Settings > Audit
 * Log demo fixture, not a queryable persisted record.
 */
export interface AuditLogRecord {
  id: string
  companyId: string
  actorId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

/** Thai labels for every audit action logged across the app — falls back to the raw action code for anything not listed. */
export const auditActionLabels: Record<string, string> = {
  CREATE_COMPANY: 'สร้างบริษัท',
  UPDATE_COMPANY: 'แก้ไขข้อมูลบริษัท',
  SELECT_DOCUMENT_TEMPLATE: 'เลือกเทมเพลตเอกสาร',
  CHANGE_DOCUMENT_TEMPLATE: 'เปลี่ยนเทมเพลตเอกสาร',
  CREATE_CUSTOMER: 'เพิ่มลูกค้า',
  UPDATE_CUSTOMER: 'แก้ไขข้อมูลลูกค้า',
  SOFT_DELETE_CUSTOMER: 'ลบลูกค้า',
  ACCEPT_INVITATION: 'ยอมรับคำเชิญ',
  INVITE_MEMBER: 'เชิญสมาชิก',
  CHANGE_ROLE: 'เปลี่ยนบทบาทสมาชิก',
  REMOVE_MEMBER: 'ลบสมาชิก',
  CANCEL_INVITATION: 'ยกเลิกคำเชิญ',
  SAVE_NUMBERING_SETTING: 'บันทึกรูปแบบเลขที่เอกสาร',
  REVERT_NUMBERING_SETTING: 'คืนค่ารูปแบบเลขที่เอกสาร',
  EXPORT_DATA_JSON: 'ส่งออกข้อมูล (JSON)',
  DELETE_ACCOUNT_REQUESTED: 'ขอลบบัญชี',
  CREATE_DOCUMENT_DRAFT: 'สร้างเอกสารฉบับร่าง',
  UPDATE_DOCUMENT_DRAFT: 'แก้ไขเอกสารฉบับร่าง',
  APPROVE_DOCUMENT: 'อนุมัติเอกสาร',
  DOCUMENT_NUMBER_GENERATED: 'ออกเลขที่เอกสาร',
  MARK_DOCUMENT_PAID: 'บันทึกว่าชำระแล้ว',
  CANCEL_DOCUMENT: 'ยกเลิกเอกสาร',
  CREATE_DOCUMENT_REVISION: 'สร้าง Revision',
  APPROVE_REVISION: 'อนุมัติ Revision',
  CONVERT_DOCUMENT: 'แปลงเอกสาร',
  EXPORT_DOCUMENT_PDF: 'ส่งออก PDF',
}

export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action
}
