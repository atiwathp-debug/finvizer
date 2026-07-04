import { DEFAULT_SIGNATURE_SLOT_LABELS, type SignatureSlot } from '@/types/signature'

/**
 * A fresh company has zero rows in signature_slots until an Owner visits
 * Settings > ลายเซ็นเอกสาร — this lets every render path (on-screen preview,
 * PDF export) fall back to synthetic ผู้ซื้อ/ผู้ขาย slots instead of showing
 * a blank signature area, without needing an eager DB seed anywhere.
 */
export function withSignatureFallback(slots: SignatureSlot[]): SignatureSlot[] {
  if (slots.length > 0) return slots
  const now = new Date().toISOString()
  return DEFAULT_SIGNATURE_SLOT_LABELS.map((label, index) => ({
    id: `default-${index}`,
    companyId: '',
    label,
    sortOrder: index,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  }))
}
