import { Badge } from '@/components/ui/Badge'
import { roleLabels, type MemberRole } from '@/types/member'

const roleTone: Record<MemberRole, 'brand' | 'accent' | 'neutral'> = {
  OWNER: 'brand',
  ADMIN: 'brand',
  ACCOUNTANT: 'accent',
  EDITOR: 'accent',
  VIEWER: 'neutral',
}

export function RoleBadge({ role }: { role: MemberRole }) {
  return <Badge tone={roleTone[role]}>{roleLabels[role]}</Badge>
}
