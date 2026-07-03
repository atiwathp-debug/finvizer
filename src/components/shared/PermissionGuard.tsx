import type { ReactNode } from 'react'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import type { MemberRole } from '@/types/member'

interface PermissionGuardProps {
  /** Roles allowed to see `children` — see the ROLE & PERMISSION matrix in the project spec. */
  allow: MemberRole[]
  /** Rendered instead when the current role isn't in `allow` (e.g. a disabled/read-only view). */
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({ allow, fallback = null, children }: PermissionGuardProps) {
  const isAllowed = useHasCompanyRole(allow)
  return <>{isAllowed ? children : fallback}</>
}
