import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { mockAuditLogs } from '@/lib/mock/auditLogs'

export function AuditLogPage() {
  return (
    <div className="space-y-4">
      <PhaseNotice>
        รายการด้านล่างเป็นข้อมูลตัวอย่าง (Mock Mode) — ประวัติการใช้งานจริงจะบันทึกทุก action สำคัญตั้งแต่ Phase 1C
        เป็นต้นไป
      </PhaseNotice>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <ul className="divide-y divide-line">
          {mockAuditLogs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm text-ink">{log.action}</p>
                <p className="text-xs text-ink-muted">โดย {log.actor}</p>
              </div>
              <span className="text-xs text-ink-muted">{log.createdAt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
