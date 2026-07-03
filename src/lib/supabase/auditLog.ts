import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import { appendMockAuditLog, listMockAuditLogsForEntity } from '@/lib/mock/mockAuditLogs'
import { logError } from '@/lib/utils/debugLog'
import type { Json } from '@/types/database'
import type { AuditLogRecord } from '@/types/auditLog'

interface LogAuditEventParams {
  companyId: string
  actorId: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, Json>
}

/**
 * Fire-and-forget: audit logging failing must never block the user action
 * that triggered it, so errors are logged for debugging and swallowed here
 * rather than surfaced to the caller.
 *
 * Mock Mode persists to localStorage as of Phase 6A (see
 * lib/mock/mockAuditLogs.ts), powering the document detail page's
 * activity timeline. Earlier phases treated Mock Mode audit logging as a
 * pure no-op since nothing read it back yet — Settings > Audit Log
 * (Phase 1D) still shows its own separate static Thai demo data
 * regardless of real actions, since only the document timeline was asked
 * to read real entries this phase.
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  if (isMockMode) {
    appendMockAuditLog(params)
    return
  }

  try {
    const { error } = await requireSupabase()
      .from('audit_logs')
      .insert({
        company_id: params.companyId,
        actor_id: params.actorId,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        metadata: params.metadata ?? {},
      })
    if (error) throw error
  } catch (error) {
    logError('auditLog.logAuditEvent', error, { ...params })
  }
}

function mapAuditLogRow(row: {
  id: string
  company_id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Json
  created_at: string
}): AuditLogRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  }
}

/**
 * All audit log entries for a given entity, oldest first — powers the
 * document detail page's activity timeline (Phase 6A). Real mode reads
 * directly from `audit_logs` (append-only, `audit_logs_select_same_company`
 * RLS policy already scopes this to the caller's own company).
 */
export async function listAuditLogsForEntity(entityType: string, entityId: string): Promise<AuditLogRecord[]> {
  if (isMockMode) return listMockAuditLogsForEntity(entityType, entityId)

  try {
    const { data, error } = await requireSupabase()
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapAuditLogRow)
  } catch (error) {
    logError('auditLog.listAuditLogsForEntity', error, { entityType, entityId })
    throw error
  }
}
