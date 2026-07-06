import type { DocumentTemplateEnum } from '@/types/database'
import type { LogoPosition } from '@/types/logoLayout'
import type { DocumentTemplateTextOverrides } from '@/lib/templates/documentTemplateText'

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
  /** Side length (px/pt) of the square box the logo renders inside — see src/types/logoLayout.ts. */
  logoSize: number
  /** Which document-header slot the logo renders at (Pass 2.1) — see src/types/logoLayout.ts. */
  logoPosition: LogoPosition
  /** Pass 4: per-company overrides for document template display text — see src/lib/templates/documentTemplateText.ts. */
  templateTextOverrides: DocumentTemplateTextOverrides
  createdAt: string
  updatedAt: string
}
