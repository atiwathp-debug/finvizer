import {
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  Download,
  FilePlus2,
  GitBranch,
  Pencil,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { auditActionLabel, type AuditLogRecord } from '@/types/auditLog'

const actionIcons: Record<string, LucideIcon> = {
  CREATE_DOCUMENT_DRAFT: FilePlus2,
  UPDATE_DOCUMENT_DRAFT: Pencil,
  APPROVE_DOCUMENT: BadgeCheck,
  APPROVE_REVISION: BadgeCheck,
  MARK_DOCUMENT_PAID: Wallet,
  CANCEL_DOCUMENT: Ban,
  CREATE_DOCUMENT_REVISION: GitBranch,
  CONVERT_DOCUMENT: ArrowRightLeft,
  EXPORT_DOCUMENT_PDF: Download,
}

/**
 * A chronological activity feed for one document, reading straight from
 * audit_logs (real mode) or the Mock Mode equivalent (Phase 6A) — see
 * listAuditLogsForEntity(). Purely presentational; the caller is
 * responsible for fetching `logs` and re-fetching after actions that
 * produce new entries.
 */
export function DocumentTimeline({ logs }: { logs: AuditLogRecord[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink-muted">ยังไม่มีประวัติกิจกรรมสำหรับเอกสารนี้</p>
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => {
        const Icon = actionIcons[log.action] ?? FilePlus2
        const documentNumber =
          typeof log.metadata.documentNumber === 'string' ? log.metadata.documentNumber : null
        return (
          <li key={log.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                {auditActionLabel(log.action)}
                {documentNumber && <span className="text-ink-muted"> · {documentNumber}</span>}
              </p>
              <p className="text-xs text-ink-muted">{new Date(log.createdAt).toLocaleString('th-TH')}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
