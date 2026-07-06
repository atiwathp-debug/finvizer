import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  createMockCompany,
  getMockCompanyForUser,
  updateMockCompany,
  updateMockCompanyLogo,
  updateMockCompanyLogoLayout,
  updateMockCompanyTemplate,
} from '@/lib/mock/mockCompany'
import { logError } from '@/lib/utils/debugLog'
import { clampLogoSize, type LogoPosition } from '@/types/logoLayout'
import type { CompanyRow, DocumentTemplateEnum } from '@/types/database'
import type { Company } from '@/types/company'
import type { MemberRole } from '@/types/member'

export function mapCompanyRow(row: CompanyRow): Company {
  return {
    id: row.id,
    ownerId: row.owner_id,
    nameTh: row.name_th,
    nameEn: row.name_en,
    companyCode: row.company_code,
    taxId: row.tax_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logoUrl: row.logo_url,
    contactName: row.contact_name,
    documentTemplate: row.document_template,
    logoSize: row.logo_size,
    logoPosition: row.logo_position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CompanyOnboardingInput {
  nameTh: string
  nameEn: string
  companyCode: string
  taxId: string
  address: string
  phone: string
  email: string
  contactName: string
}

export interface CompanySettingsInput {
  nameTh: string
  nameEn: string
  taxId: string
  address: string
  phone: string
  email: string
  contactName: string
}

export interface CurrentCompanyResult {
  company: Company
  role: MemberRole
}

/** Looks up the company + role the given user belongs to, if any — owner or invited member alike. */
export async function getCurrentCompanyForUser(
  userId: string,
): Promise<CurrentCompanyResult | null> {
  if (isMockMode) return getMockCompanyForUser(userId)

  try {
    const client = requireSupabase()
    const { data: membership, error: membershipError } = await client
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return null

    const { data: company, error: companyError } = await client
      .from('companies')
      .select('*')
      .eq('id', membership.company_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (companyError) throw companyError
    return company ? { company: mapCompanyRow(company), role: membership.role } : null
  } catch (error) {
    logError('company.getCurrentCompanyForUser', error, { userId })
    return null
  }
}

export async function createCompany(
  userId: string,
  input: CompanyOnboardingInput,
): Promise<Company> {
  if (isMockMode) return createMockCompany(userId, input)

  try {
    const { data, error } = await requireSupabase().rpc('create_company_with_owner', {
      p_name_th: input.nameTh,
      p_name_en: input.nameEn || null,
      p_company_code: input.companyCode,
      p_tax_id: input.taxId,
      p_address: input.address || null,
      p_phone: input.phone || null,
      p_email: input.email || null,
      p_contact_name: input.contactName || null,
      p_logo_url: null,
    })
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('company.createCompany', error, { userId, input })
    throw error
  }
}

export async function updateCompany(
  companyId: string,
  input: CompanySettingsInput,
): Promise<Company> {
  if (isMockMode) return updateMockCompany(companyId, input)

  try {
    const { data, error } = await requireSupabase()
      .from('companies')
      .update({
        name_th: input.nameTh,
        name_en: input.nameEn || null,
        tax_id: input.taxId,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        contact_name: input.contactName || null,
      })
      .eq('id', companyId)
      .select()
      .single()
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('company.updateCompany', error, { companyId, input })
    throw error
  }
}

export const LOGO_MAX_BYTES_REAL = 2 * 1024 * 1024
export const LOGO_MAX_BYTES_MOCK = 500 * 1024
export const LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

function logoFileExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName) return fromName.toLowerCase()
  return file.type.split('/').pop() ?? 'png'
}

/**
 * Uploads a company's logo to the public `company-logos` Storage bucket
 * (20260718120000_company_logo_storage.sql) at `${companyId}/logo.<ext>`
 * — a fixed, predictable path (not a random filename) so re-uploading
 * always overwrites the previous logo instead of accumulating orphaned
 * files, and so the RLS write policy can authorize purely from the path.
 */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ PNG, JPG, SVG หรือ WEBP เท่านั้น')
  }
  if (file.size > LOGO_MAX_BYTES_REAL) {
    throw new Error('ขนาดไฟล์ต้องไม่เกิน 2MB')
  }
  if (isMockMode) {
    throw new Error('ฟังก์ชันนี้ใช้ได้เฉพาะเมื่อเชื่อมต่อ Supabase จริงเท่านั้น')
  }

  try {
    const client = requireSupabase()
    const path = `${companyId}/logo.${logoFileExtension(file)}`
    const { error: uploadError } = await client.storage
      .from('company-logos')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data } = client.storage.from('company-logos').getPublicUrl(path)
    // Cache-bust the public URL so the newly uploaded file shows immediately
    // instead of a stale CDN-cached copy at the same path.
    const logoUrl = `${data.publicUrl}?v=${Date.now()}`

    const { error: updateError } = await client
      .from('companies')
      .update({ logo_url: logoUrl })
      .eq('id', companyId)
    if (updateError) throw updateError

    return logoUrl
  } catch (error) {
    logError('company.uploadCompanyLogo', error, { companyId })
    throw error
  }
}

/** Clears a company's logo — best-effort Storage cleanup, then always clears logo_url regardless of whether a file existed. */
export async function removeCompanyLogo(companyId: string): Promise<Company> {
  if (isMockMode) return updateMockCompanyLogo(companyId, null)

  try {
    const client = requireSupabase()
    // Best-effort cleanup — the exact extension used at upload time isn't
    // tracked separately, so try every extension logoFileExtension() could
    // have produced; a missing-file error from any of these is harmless.
    await client.storage
      .from('company-logos')
      .remove(['png', 'jpg', 'jpeg', 'svg', 'webp'].map((ext) => `${companyId}/logo.${ext}`))
    const { data, error } = await client
      .from('companies')
      .update({ logo_url: null })
      .eq('id', companyId)
      .select()
      .single()
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('company.removeCompanyLogo', error, { companyId })
    throw error
  }
}

/**
 * Sets the company's default document template — used both by first-time
 * selection (/onboarding/template, Phase 2A) and later changes in
 * Settings > Templates. Same underlying write either way.
 */
export async function updateCompanyTemplate(
  companyId: string,
  template: DocumentTemplateEnum,
): Promise<Company> {
  if (isMockMode) return updateMockCompanyTemplate(companyId, template)

  try {
    const { data, error } = await requireSupabase()
      .from('companies')
      .update({ document_template: template })
      .eq('id', companyId)
      .select()
      .single()
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('company.updateCompanyTemplate', error, { companyId, template })
    throw error
  }
}

export interface CompanyLogoLayoutInput {
  logoSize: number
  logoPosition: LogoPosition
}

/**
 * Sets the company's logo size/position for document headers (Pass 2.1) —
 * a separate save action from both the main info form (updateCompany) and
 * the logo file itself (uploadCompanyLogo/removeCompanyLogo), same
 * pattern as updateCompanyTemplate above. logoSize is clamped client-side
 * before it ever reaches the request; the database's own check constraint
 * (20260719120000_company_logo_layout.sql) is the final backstop.
 */
export async function updateCompanyLogoLayout(
  companyId: string,
  input: CompanyLogoLayoutInput,
): Promise<Company> {
  const logoSize = clampLogoSize(input.logoSize)
  if (isMockMode) return updateMockCompanyLogoLayout(companyId, { logoSize, logoPosition: input.logoPosition })

  try {
    const { data, error } = await requireSupabase()
      .from('companies')
      .update({ logo_size: logoSize, logo_position: input.logoPosition })
      .eq('id', companyId)
      .select()
      .single()
    if (error) throw error
    return mapCompanyRow(data)
  } catch (error) {
    logError('company.updateCompanyLogoLayout', error, { companyId, input })
    throw error
  }
}
