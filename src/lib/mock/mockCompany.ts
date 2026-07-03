import { addMockMember, getMockMembershipForUser } from '@/lib/mock/mockMembers'
import type { Company } from '@/types/company'
import type { DocumentTemplateEnum } from '@/types/database'
import type { MemberRole } from '@/types/member'

const COMPANIES_KEY = 'finvizer_mock_companies'

function readCompanies(): Company[] {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY)
    return raw ? (JSON.parse(raw) as Company[]) : []
  } catch {
    return []
  }
}

function writeCompanies(companies: Company[]) {
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies))
}

export function getMockCompanyById(companyId: string): Company | null {
  return readCompanies().find((c) => c.id === companyId) ?? null
}

/** Used by lib/mock/mockAccount.ts when the OWNER deletes their account. */
export function deleteMockCompany(companyId: string): void {
  writeCompanies(readCompanies().filter((c) => c.id !== companyId))
}

/**
 * Looks up the company + role for a user via their company_members
 * membership (not company.ownerId) — correct for both owners and invited
 * members, and the actual "1 user = 1 company" source of truth.
 */
export function getMockCompanyForUser(
  userId: string,
): { company: Company; role: MemberRole } | null {
  const membership = getMockMembershipForUser(userId)
  if (!membership) return null
  const company = getMockCompanyById(membership.companyId)
  return company ? { company, role: membership.role } : null
}

export interface MockCompanyOnboardingInput {
  nameTh: string
  nameEn: string
  companyCode: string
  taxId: string
  address: string
  phone: string
  email: string
  contactName: string
}

export function createMockCompany(userId: string, input: MockCompanyOnboardingInput): Company {
  if (getMockMembershipForUser(userId)) {
    throw new Error('คุณมีบริษัทอยู่แล้ว ไม่สามารถสร้างบริษัทใหม่ได้')
  }

  const now = new Date().toISOString()
  const company: Company = {
    id: crypto.randomUUID(),
    ownerId: userId,
    nameTh: input.nameTh,
    nameEn: input.nameEn || null,
    companyCode: input.companyCode,
    taxId: input.taxId,
    branchCode: 'HQ',
    branchName: 'สำนักงานใหญ่',
    address: input.address || null,
    phone: input.phone || null,
    email: input.email || null,
    logoUrl: null,
    contactName: input.contactName || null,
    documentTemplate: null,
    createdAt: now,
    updatedAt: now,
  }
  writeCompanies([...readCompanies(), company])
  // Mirrors create_company_with_owner's atomic insert — not truly atomic in
  // localStorage, but company creation + this bootstrap membership insert
  // are both simple, always-succeeding local writes in practice.
  addMockMember(company.id, userId, 'OWNER')
  return company
}

export interface MockCompanySettingsInput {
  nameTh: string
  nameEn: string
  taxId: string
  address: string
  phone: string
  email: string
  contactName: string
}

export function updateMockCompany(companyId: string, input: MockCompanySettingsInput): Company {
  const companies = readCompanies()
  const index = companies.findIndex((c) => c.id === companyId)
  if (index === -1) {
    throw new Error('ไม่พบบริษัท')
  }

  const updated: Company = {
    ...companies[index],
    nameTh: input.nameTh,
    nameEn: input.nameEn || null,
    taxId: input.taxId,
    address: input.address || null,
    phone: input.phone || null,
    email: input.email || null,
    contactName: input.contactName || null,
    updatedAt: new Date().toISOString(),
  }
  companies[index] = updated
  writeCompanies(companies)
  return updated
}

/** Used by lib/supabase/company.ts's updateCompanyTemplate — Phase 2A first-time and Settings > Templates changes alike. */
export function updateMockCompanyTemplate(
  companyId: string,
  template: DocumentTemplateEnum,
): Company {
  const companies = readCompanies()
  const index = companies.findIndex((c) => c.id === companyId)
  if (index === -1) {
    throw new Error('ไม่พบบริษัท')
  }

  const updated: Company = {
    ...companies[index],
    documentTemplate: template,
    updatedAt: new Date().toISOString(),
  }
  companies[index] = updated
  writeCompanies(companies)
  return updated
}
