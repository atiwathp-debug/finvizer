import type { DocumentTemplateEnum } from '@/types/database'

export interface Company {
  id: string
  /** Null once the owner's account has been deleted (Phase 1E) — the company row is soft-deleted, not removed. */
  ownerId: string | null
  nameTh: string
  nameEn: string | null
  companyCode: string
  taxId: string
  branchCode: string
  branchName: string
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
  contactName: string | null
  documentTemplate: DocumentTemplateEnum | null
  createdAt: string
  updatedAt: string
}
