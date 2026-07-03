import { create } from 'zustand'
import { getCurrentCompanyForUser } from '@/lib/supabase/company'
import type { Company } from '@/types/company'
import type { MemberRole } from '@/types/member'

type CompanyStatus = 'loading' | 'has_company' | 'no_company'

interface CompanyState {
  status: CompanyStatus
  company: Company | null
  /** The signed-in user's role within `company` — null whenever company is null. */
  currentUserRole: MemberRole | null
  /** Called by RootLayout whenever the signed-in user changes (login/logout/switch). */
  syncForUser: (userId: string | null) => Promise<void>
  /** Updates company details only (e.g. after editing Settings) — role is unaffected. */
  setCompany: (company: Company) => void
  /** Sets both at once — used right after creating a company or accepting an invite. */
  setCompanyAndRole: (company: Company, role: MemberRole) => void
}

export const useCompanyStore = create<CompanyState>((set) => ({
  status: 'loading',
  company: null,
  currentUserRole: null,

  syncForUser: async (userId) => {
    if (!userId) {
      set({ status: 'no_company', company: null, currentUserRole: null })
      return
    }
    set({ status: 'loading' })
    const result = await getCurrentCompanyForUser(userId)
    set({
      company: result?.company ?? null,
      currentUserRole: result?.role ?? null,
      status: result ? 'has_company' : 'no_company',
    })
  },

  setCompany: (company) => set({ company, status: 'has_company' }),

  setCompanyAndRole: (company, role) =>
    set({ company, currentUserRole: role, status: 'has_company' }),
}))
