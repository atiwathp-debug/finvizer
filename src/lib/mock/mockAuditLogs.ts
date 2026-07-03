import type { AuditLogRecord } from '@/types/auditLog'
import type { Json } from '@/types/database'

const AUDIT_LOGS_KEY = 'finvizer_mock_audit_logs'

function readAuditLogs(): AuditLogRecord[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY)
    return raw ? (JSON.parse(raw) as AuditLogRecord[]) : []
  } catch {
    return []
  }
}

function writeAuditLogs(logs: AuditLogRecord[]) {
  localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs))
}

interface AppendMockAuditLogParams {
  companyId: string
  actorId: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, Json>
}

/**
 * Mock Mode's equivalent of an `audit_logs` insert — as of Phase 6A this
 * is called both by logAuditEvent() (for actions a page logs itself,
 * e.g. CREATE_DOCUMENT_DRAFT) and directly by the mock document-mutation
 * functions that mirror a self-logging real RPC (e.g.
 * approveMockDraftDocument mirroring approve_document()'s own
 * `insert into audit_logs`), so Mock Mode and real mode end up with the
 * same entries either way.
 */
export function appendMockAuditLog(params: AppendMockAuditLogParams): AuditLogRecord {
  const log: AuditLogRecord = {
    id: crypto.randomUUID(),
    companyId: params.companyId,
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
    createdAt: new Date().toISOString(),
  }
  writeAuditLogs([...readAuditLogs(), log])
  return log
}

/** All audit log entries for a given entity, oldest first — powers the document detail page's activity timeline. */
export function listMockAuditLogsForEntity(entityType: string, entityId: string): AuditLogRecord[] {
  return readAuditLogs()
    .filter((log) => log.entityType === entityType && log.entityId === entityId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
