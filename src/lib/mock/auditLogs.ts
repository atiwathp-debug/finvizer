export interface MockAuditLog {
  id: string
  action: string
  actor: string
  createdAt: string
}

/** Thai mock data — fictional audit trail only. */
export const mockAuditLogs: MockAuditLog[] = [
  { id: 'log-1', action: 'อนุมัติเอกสาร IV-20260628-0004', actor: 'สมชาย ใจดี', createdAt: '2026-07-02 09:14' },
  { id: 'log-2', action: 'สร้างเอกสารฉบับร่าง (ใบเสนอราคา)', actor: 'ปกรณ์ ขยันพิมพ์', createdAt: '2026-07-02 08:50' },
  { id: 'log-3', action: 'เพิ่มลูกค้า บริษัท บลูโอเชียน โลจิสติกส์ จำกัด', actor: 'สุนีย์ บัญชีเก่ง', createdAt: '2026-07-01 16:22' },
  { id: 'log-4', action: 'เปลี่ยนสถานะเอกสารเป็นชำระแล้ว', actor: 'สุนีย์ บัญชีเก่ง', createdAt: '2026-07-01 14:05' },
  { id: 'log-5', action: 'เข้าสู่ระบบ', actor: 'สมชาย ใจดี', createdAt: '2026-07-01 08:31' },
]
