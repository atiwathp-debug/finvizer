import type { SignatureSlot } from '@/types/signature'

const SIGNATURE_SLOTS_KEY = 'finvizer_mock_signature_slots'

function readSlots(): SignatureSlot[] {
  try {
    const raw = localStorage.getItem(SIGNATURE_SLOTS_KEY)
    return raw ? (JSON.parse(raw) as SignatureSlot[]) : []
  } catch {
    return []
  }
}

function writeSlots(slots: SignatureSlot[]) {
  localStorage.setItem(SIGNATURE_SLOTS_KEY, JSON.stringify(slots))
}

export function listMockSignatureSlots(companyId: string): SignatureSlot[] {
  return readSlots()
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export interface MockSignatureSlotInput {
  id?: string
  label: string
  sortOrder: number
  isDefault: boolean
}

/** Full delete-then-reinsert for one company's ordered list — same tradeoff as saveMockDocumentDraft's item replacement; the whole list is edited and saved as one unit from the Settings page. */
export function saveMockSignatureSlots(companyId: string, slots: MockSignatureSlotInput[]): SignatureSlot[] {
  const now = new Date().toISOString()
  const saved: SignatureSlot[] = slots.map((slot) => ({
    id: slot.id ?? crypto.randomUUID(),
    companyId,
    label: slot.label,
    sortOrder: slot.sortOrder,
    isDefault: slot.isDefault,
    createdAt: now,
    updatedAt: now,
  }))
  const others = readSlots().filter((s) => s.companyId !== companyId)
  writeSlots([...others, ...saved])
  return saved
}
