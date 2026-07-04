import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { listSignatureSlots, saveSignatureSlots, type SignatureSlotInput } from '@/lib/supabase/signatureSlots'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { DEFAULT_SIGNATURE_SLOT_LABELS } from '@/types/signature'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'

function defaultEditableSlots(): SignatureSlotInput[] {
  return DEFAULT_SIGNATURE_SLOT_LABELS.map((label, index) => ({ label, sortOrder: index, isDefault: true }))
}

export function SignatureSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [editableSlots, setEditableSlots] = useState<SignatureSlotInput[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      const slots = await listSignatureSlots(company.id)
      // A company with no slots yet gets the two defaults pre-populated in
      // local (unsaved) edit state — clicking "บันทึกการเปลี่ยนแปลง" once
      // persists them, no separate "seed defaults" action needed.
      setEditableSlots(
        slots.length > 0
          ? slots.map((s) => ({ id: s.id, label: s.label, sortOrder: s.sortOrder, isDefault: s.isDefault }))
          : defaultEditableSlots(),
      )
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company])

  useEffect(() => {
    void load()
  }, [load])

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  const updateLabel = (index: number, label: string) => {
    setEditableSlots((prev) => prev?.map((slot, i) => (i === index ? { ...slot, label } : slot)) ?? prev)
  }

  const moveSlot = (index: number, direction: -1 | 1) => {
    setEditableSlots((prev) => {
      if (!prev) return prev
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((slot, i) => ({ ...slot, sortOrder: i }))
    })
  }

  const removeSlot = (index: number) => {
    setEditableSlots((prev) => prev?.filter((_, i) => i !== index).map((slot, i) => ({ ...slot, sortOrder: i })) ?? prev)
  }

  const addSlot = () => {
    setEditableSlots((prev) => [...(prev ?? []), { label: '', sortOrder: prev?.length ?? 0, isDefault: false }])
  }

  const handleSave = async () => {
    if (!editableSlots || !user) return
    if (editableSlots.some((slot) => !slot.label.trim())) {
      toast({ title: 'กรุณากรอกชื่อลายเซ็นให้ครบทุกช่อง', tone: 'error' })
      return
    }
    setIsSaving(true)
    try {
      const saved = await saveSignatureSlots(company.id, editableSlots)
      setEditableSlots(saved.map((s) => ({ id: s.id, label: s.label, sortOrder: s.sortOrder, isDefault: s.isDefault })))
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'UPDATE_SIGNATURE_SLOTS',
        entityType: 'company',
        entityId: company.id,
      })
      toast({ title: 'บันทึกการตั้งค่าลายเซ็นสำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PhaseNotice>
        ลายเซ็นเหล่านี้จะแสดงในตัวอย่างเอกสารและไฟล์ PDF ทุกฉบับ — ค่าเริ่มต้นคือ ผู้ซื้อ และ ผู้ขาย
        สามารถเพิ่มช่องลายเซ็นอื่น ๆ ได้ตามต้องการ เช่น ผู้จัดทำ ผู้ตรวจสอบ ผู้อนุมัติ
      </PhaseNotice>

      {!isOwner && <PhaseNotice>คุณมีสิทธิ์ดูการตั้งค่าลายเซ็นเท่านั้น — เฉพาะเจ้าของบริษัทที่แก้ไขได้</PhaseNotice>}

      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        {editableSlots === null ? (
          <TableSkeleton rows={2} />
        ) : (
          <div className="space-y-3">
            {editableSlots.map((slot, index) => (
              <div key={slot.id ?? `new-${index}`} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs text-ink-muted">{index + 1}</span>
                <Input
                  value={slot.label}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  disabled={!isOwner}
                  aria-label={`ชื่อช่องลายเซ็น ${index + 1}`}
                  placeholder="เช่น ผู้ซื้อ, ผู้ขาย, ผู้อนุมัติ"
                />
                {isOwner && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSlot(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-surface disabled:pointer-events-none disabled:opacity-30"
                      aria-label="เลื่อนขึ้น"
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlot(index, 1)}
                      disabled={index === editableSlots.length - 1}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-surface disabled:pointer-events-none disabled:opacity-30"
                      aria-label="เลื่อนลง"
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      disabled={editableSlots.length <= 1}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                      aria-label="ลบช่องลายเซ็นนี้"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isOwner && (
              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มช่องลายเซ็น
                </Button>
                <Button type="button" isLoading={isSaving} onClick={() => void handleSave()}>
                  บันทึกการเปลี่ยนแปลง
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
