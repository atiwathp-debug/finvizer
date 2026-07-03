import { useCompanyStore } from '@/stores/companyStore'
import type { MemberRole } from '@/types/member'

/** True if the signed-in user's role in the current company is one of `allowedRoles`. */
export function useHasCompanyRole(allowedRoles: MemberRole[]): boolean {
  const role = useCompanyStore((state) => state.currentUserRole)
  return role !== null && allowedRoles.includes(role)
}
