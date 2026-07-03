import { Badge } from '@/components/ui/Badge'
import { documentStatusLabels, type DocumentStatus } from '@/types/document'

const statusTone: Record<DocumentStatus, 'neutral' | 'brand' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  APPROVED: 'brand',
  PAID: 'success',
  CANCELLED: 'danger',
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={statusTone[status]}>{documentStatusLabels[status]}</Badge>
}
