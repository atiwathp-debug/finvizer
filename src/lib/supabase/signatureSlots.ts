import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import { listMockSignatureSlots, saveMockSignatureSlots, type MockSignatureSlotInput } from '@/lib/mock/mockSignatureSlots'
import { logError } from '@/lib/utils/debugLog'
import type { SignatureSlot } from '@/types/signature'

function mapSignatureSlotRow(row: {
  id: string
  company_id: string
  label: string
  sort_order: number
  is_default: boolean
  created_at: string
  updated_at: string
}): SignatureSlot {
  return {
    id: row.id,
    companyId: row.company_id,
    label: row.label,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listSignatureSlots(companyId: string): Promise<SignatureSlot[]> {
  if (isMockMode) return listMockSignatureSlots(companyId)

  try {
    const { data, error } = await requireSupabase()
      .from('signature_slots')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order')
    if (error) throw error
    return (data ?? []).map(mapSignatureSlotRow)
  } catch (error) {
    logError('signatureSlots.listSignatureSlots', error, { companyId })
    throw error
  }
}

export type SignatureSlotInput = MockSignatureSlotInput

/**
 * Full delete-then-reinsert of a company's ordered signature-slot list —
 * mirrors saveDraftDocument's "delete all document_items, reinsert" pattern
 * exactly, since the whole list is always edited and saved as one unit
 * from the Settings page (never a single-row patch).
 */
export async function saveSignatureSlots(companyId: string, slots: SignatureSlotInput[]): Promise<SignatureSlot[]> {
  if (isMockMode) return saveMockSignatureSlots(companyId, slots)

  try {
    const client = requireSupabase()
    const { error: deleteError } = await client.from('signature_slots').delete().eq('company_id', companyId)
    if (deleteError) throw deleteError

    if (slots.length === 0) return []

    const { data, error: insertError } = await client
      .from('signature_slots')
      .insert(
        slots.map((slot) => ({
          company_id: companyId,
          label: slot.label,
          sort_order: slot.sortOrder,
          is_default: slot.isDefault,
        })),
      )
      .select()
      .order('sort_order')
    if (insertError) throw insertError
    return (data ?? []).map(mapSignatureSlotRow)
  } catch (error) {
    logError('signatureSlots.saveSignatureSlots', error, { companyId })
    throw error
  }
}
