/**
 * One company-wide ordered list of signature slots (production readiness
 * pass 2) — buyer + seller by default, freeform extra slots (e.g.
 * ผู้จัดทำ, ผู้ตรวจสอบ, ผู้อนุมัติ). See
 * supabase/migrations/20260715120000_signature_slots.sql.
 */
export interface SignatureSlot {
  id: string
  companyId: string
  label: string
  sortOrder: number
  /** True for the two rows a fresh Settings page pre-populates (ผู้ซื้อ/ผู้ขาย) — informational only, not enforced. */
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export const DEFAULT_SIGNATURE_SLOT_LABELS = ['ผู้ซื้อ', 'ผู้ขาย'] as const
