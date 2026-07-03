import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  createMockCompany,
  getMockCompanyForUser,
  updateMockCompany,
  updateMockCompanyTemplate,
} from '@/lib/mock/mockCompany'
import { logError } from '@/lib/utils/debugLog'
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
