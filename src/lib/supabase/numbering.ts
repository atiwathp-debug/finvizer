import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  deleteMockNumberingSettingOverride,
  listMockNumberingSettings,
  saveMockNumberingSetting,
} from '@/lib/mock/mockNumbering'
import { logError } from '@/lib/utils/debugLog'
import type { DocumentType } from '@/types/document'
import type { NumberingSetting, ResetPolicy } from '@/types/numbering'

function mapNumberingRow(row: {
  id: string
  company_id: string
  document_type: string | null
  pattern: string
  reset_policy: ResetPolicy
  created_at: string
  updated_at: string
}): NumberingSetting {
  return {
    id: row.id,
    companyId: row.company_id,
    documentType: row.document_type as DocumentType | null,
    pattern: row.pattern,
    resetPolicy: row.reset_policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listNumberingSettings(companyId: string): Promise<NumberingSetting[]> {
  if (isMockMode) return listMockNumberingSettings(companyId)

  try {
    const { data, error } = await requireSupabase()
      .from('numbering_settings')
      .select('*')
      .eq('company_id', companyId)
    if (error) throw error
    return (data ?? []).map(mapNumberingRow)
  } catch (error) {
    logError('numbering.listNumberingSettings', error, { companyId })
    throw error
  }
}

/**
 * Upserts by (companyId, documentType) — null documentType is the
 * company-wide default. Done as select-then-insert-or-update rather than
 * a single `.upsert()` call: the DB's uniqueness backstop is two *partial*
 * unique indexes (one for the null-documentType default, one for
 * non-null overrides — see supabase/migrations/20260706120000_numbering_settings.sql),
 * and postgrest-js's `onConflict` option can't target a partial index.
 */
export async function saveNumberingSetting(
  companyId: string,
  documentType: DocumentType | null,
  pattern: string,
  resetPolicy: ResetPolicy,
): Promise<NumberingSetting> {
  if (isMockMode) return saveMockNumberingSetting(companyId, documentType, pattern, resetPolicy)

  try {
    const client = requireSupabase()
    let existingQuery = client
      .from('numbering_settings')
      .select('id')
      .eq('company_id', companyId)
    existingQuery =
      documentType === null
        ? existingQuery.is('document_type', null)
        : existingQuery.eq('document_type', documentType)
    const { data: existing, error: existingError } = await existingQuery.maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      const { data, error } = await client
        .from('numbering_settings')
        .update({ pattern, reset_policy: resetPolicy })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return mapNumberingRow(data)
    }

    const { data, error } = await client
      .from('numbering_settings')
      .insert({ company_id: companyId, document_type: documentType, pattern, reset_policy: resetPolicy })
      .select()
      .single()
    if (error) throw error
    return mapNumberingRow(data)
  } catch (error) {
    logError('numbering.saveNumberingSetting', error, { companyId, documentType, pattern, resetPolicy })
    throw error
  }
}

export async function deleteNumberingSettingOverride(
  companyId: string,
  documentType: DocumentType,
): Promise<void> {
  if (isMockMode) return deleteMockNumberingSettingOverride(companyId, documentType)

  try {
    const { error } = await requireSupabase()
      .from('numbering_settings')
      .delete()
      .eq('company_id', companyId)
      .eq('document_type', documentType)
    if (error) throw error
  } catch (error) {
    logError('numbering.deleteNumberingSettingOverride', error, { companyId, documentType })
    throw error
  }
}
