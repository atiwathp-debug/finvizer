import type { ResetPolicy } from '@/types/database'
import type { DocumentType } from '@/types/document'

export type { ResetPolicy }

export const resetPolicyLabels: Record<ResetPolicy, string> = {
  DAILY: 'รายวัน',
  MONTHLY: 'รายเดือน',
  YEARLY: 'รายปี',
  NEVER: 'ไม่รีเซ็ต',
}

export const DEFAULT_RESET_POLICY: ResetPolicy = 'MONTHLY'

export interface NumberingSetting {
  id: string
  companyId: string
  /** null = the company-wide default that applies to every document type. */
  documentType: DocumentType | null
  pattern: string
  resetPolicy: ResetPolicy
  createdAt: string
  updatedAt: string
}
