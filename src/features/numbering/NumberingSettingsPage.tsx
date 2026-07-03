import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, Pencil, RotateCcw } from 'lucide-react'
import {
  deleteNumberingSettingOverride,
  listNumberingSettings,
  saveNumberingSetting,
} from '@/lib/supabase/numbering'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { NUMBERING_PRESET_PATTERNS, renderPatternPreview } from '@/lib/validations/numberingPattern'
import { NumberingPatternEditor } from '@/components/numbering/NumberingPatternEditor'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from '@/stores/toastStore'
import { documentTypeLabels, documentTypeShortCode, type DocumentType } from '@/types/document'
import { DEFAULT_RESET_POLICY, type NumberingSetting } from '@/types/numbering'

const DOCUMENT_TYPES = Object.keys(documentTypeLabels) as DocumentType[]
const NUMBERING_WARNING =
  'เลขเอกสารจะถูกสร้างโดยระบบเท่านั้น ไม่สามารถแก้เลขเอกสารเองได้ เพื่อป้องกันเลขซ้ำและรักษาความถูกต้องทางบัญชี'

export function NumberingSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [settings, setSettings] = useState<NumberingSetting[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [overrideDialogType, setOverrideDialogType] = useState<DocumentType | null>(null)
  const [revertTarget, setRevertTarget] = useState<DocumentType | null>(null)

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      setSettings(await listNumberingSettings(company.id))
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

  const defaultSetting = settings?.find((s) => s.documentType === null) ?? null
  const overrideByType = new Map(
    (settings ?? [])
      .filter((s): s is NumberingSetting & { documentType: DocumentType } => s.documentType !== null)
      .map((s) => [s.documentType, s]),
  )

  const baseContext = { companyCode: company.companyCode, branchCode: company.branchCode }

  const handleSaveDefault = async (pattern: string, resetPolicy: NumberingSetting['resetPolicy']) => {
    if (!user) return
    setSavingKey('default')
    try {
      await saveNumberingSetting(company.id, null, pattern, resetPolicy)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'SAVE_NUMBERING_SETTING',
        entityType: 'numbering_settings',
        metadata: { documentType: null, pattern, resetPolicy },
      })
      toast({ title: 'บันทึกค่าเริ่มต้นสำเร็จ', tone: 'success' })
      await load()
    } catch (error) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveOverride = async (
    documentType: DocumentType,
    pattern: string,
    resetPolicy: NumberingSetting['resetPolicy'],
  ) => {
    if (!user) return
    setSavingKey(documentType)
    try {
      await saveNumberingSetting(company.id, documentType, pattern, resetPolicy)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'SAVE_NUMBERING_SETTING',
        entityType: 'numbering_settings',
        metadata: { documentType, pattern, resetPolicy },
      })
      toast({ title: `บันทึกการตั้งค่าเฉพาะ ${documentTypeLabels[documentType]} สำเร็จ`, tone: 'success' })
      setOverrideDialogType(null)
      await load()
    } catch (error) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setSavingKey(null)
    }
  }

  const handleRevertOverride = async () => {
    if (!user || !revertTarget) return
    try {
      await deleteNumberingSettingOverride(company.id, revertTarget)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'REVERT_NUMBERING_SETTING',
        entityType: 'numbering_settings',
        metadata: { documentType: revertTarget },
      })
      toast({ title: 'เปลี่ยนกลับไปใช้ค่าเริ่มต้นแล้ว', tone: 'success' })
      await load()
    } catch (error) {
      toast({
        title: 'ดำเนินการไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  const effectivePattern = defaultSetting?.pattern ?? NUMBERING_PRESET_PATTERNS[0]
  const overrideDialogSetting = overrideDialogType ? overrideByType.get(overrideDialogType) : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{NUMBERING_WARNING}</p>
      </div>

      {!isOwner && (
        <PhaseNotice>คุณมีสิทธิ์ดูการตั้งค่าเลขที่เอกสารเท่านั้น — เฉพาะเจ้าของบริษัทที่แก้ไขได้</PhaseNotice>
      )}

      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <p className="text-sm font-medium text-ink">ค่าเริ่มต้นของบริษัท</p>
        <p className="mt-1 text-sm text-ink-muted">
          ใช้กับทุกประเภทเอกสาร เว้นแต่จะตั้งค่าเฉพาะประเภทเอกสารด้านล่าง
        </p>

        <div className="mt-4">
          {settings === null ? (
            <TableSkeleton rows={2} />
          ) : (
            <NumberingPatternEditor
              key={defaultSetting?.updatedAt ?? 'default-new'}
              idPrefix="default"
              initialPattern={effectivePattern}
              initialResetPolicy={defaultSetting?.resetPolicy ?? DEFAULT_RESET_POLICY}
              context={{ ...baseContext, docTypeCode: documentTypeShortCode.QUOTATION, customerCode: 'ORCHID' }}
              disabled={!isOwner}
              isSaving={savingKey === 'default'}
              isNew={!defaultSetting}
              onSave={(pattern, resetPolicy) => void handleSaveDefault(pattern, resetPolicy)}
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <p className="text-sm font-medium text-ink">ตั้งค่าเฉพาะประเภทเอกสาร</p>
          <p className="mt-1 text-xs text-ink-muted">Override ค่าเริ่มต้นสำหรับบางประเภทเอกสารได้ตามต้องการ</p>
        </div>

        {settings === null ? (
          <div className="p-4">
            <TableSkeleton rows={4} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {DOCUMENT_TYPES.map((docType) => {
              const override = overrideByType.get(docType)
              const pattern = override?.pattern ?? effectivePattern
              const preview = renderPatternPreview(pattern, {
                ...baseContext,
                docTypeCode: documentTypeShortCode[docType],
                customerCode: 'ORCHID',
              })

              return (
                <li key={docType} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{documentTypeLabels[docType]}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-muted">{preview}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={override ? 'brand' : 'neutral'}>
                      {override ? 'ตั้งค่าเฉพาะ' : 'ใช้ค่าเริ่มต้น'}
                    </Badge>
                    {isOwner && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setOverrideDialogType(docType)}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          {override ? 'แก้ไข' : 'ตั้งค่าเฉพาะ'}
                        </Button>
                        {override && (
                          <button
                            type="button"
                            onClick={() => setRevertTarget(docType)}
                            className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"
                            aria-label={`เปลี่ยน ${documentTypeLabels[docType]} กลับไปใช้ค่าเริ่มต้น`}
                          >
                            <RotateCcw className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={overrideDialogType !== null} onOpenChange={(open) => !open && setOverrideDialogType(null)}>
        <DialogContent className="max-w-xl">
          {overrideDialogType && (
            <>
              <DialogTitle>ตั้งค่าเลขที่เอกสารเฉพาะ — {documentTypeLabels[overrideDialogType]}</DialogTitle>
              <DialogDescription>
                กำหนดรูปแบบเลขที่เอกสารที่ใช้เฉพาะประเภทนี้ แทนค่าเริ่มต้นของบริษัท
              </DialogDescription>
              <div className="mt-4">
                <NumberingPatternEditor
                  key={overrideDialogSetting?.updatedAt ?? `${overrideDialogType}-new`}
                  idPrefix={`override-${overrideDialogType}`}
                  initialPattern={overrideDialogSetting?.pattern ?? effectivePattern}
                  initialResetPolicy={overrideDialogSetting?.resetPolicy ?? defaultSetting?.resetPolicy ?? DEFAULT_RESET_POLICY}
                  context={{
                    ...baseContext,
                    docTypeCode: documentTypeShortCode[overrideDialogType],
                    customerCode: 'ORCHID',
                  }}
                  isSaving={savingKey === overrideDialogType}
                  isNew={!overrideDialogSetting}
                  onSave={(pattern, resetPolicy) =>
                    void handleSaveOverride(overrideDialogType, pattern, resetPolicy)
                  }
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revertTarget !== null}
        onOpenChange={(open) => !open && setRevertTarget(null)}
        title="เปลี่ยนกลับไปใช้ค่าเริ่มต้น"
        description={
          revertTarget
            ? `ต้องการเปลี่ยน ${documentTypeLabels[revertTarget]} กลับไปใช้ค่าเริ่มต้นของบริษัทใช่หรือไม่`
            : undefined
        }
        confirmLabel="เปลี่ยนกลับไปใช้ค่าเริ่มต้น"
        tone="danger"
        onConfirm={() => void handleRevertOverride()}
      />
    </div>
  )
}
