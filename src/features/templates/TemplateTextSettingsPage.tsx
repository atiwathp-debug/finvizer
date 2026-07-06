import { useEffect, useState } from 'react'
import { updateCompanyTemplateText } from '@/lib/supabase/company'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'
import {
  DEFAULT_DOCUMENT_TEMPLATE_TEXT,
  type DocumentTemplateText,
  type DocumentTemplateTextOverrides,
} from '@/lib/templates/documentTemplateText'
import { documentTypeLabels, type DocumentType } from '@/types/document'

/**
 * Only the "high-priority" labels the task called out (document type
 * titles, customer label, table columns, totals/VAT, dates, note) are
 * editable here for now — everything else in DocumentTemplateText
 * (discount, document-number, no-items, installment labels) still has a
 * working Thai default via resolveDocumentTemplateText, just no Settings
 * UI yet. Signature labels are already covered by Settings > ลายเซ็นเอกสาร,
 * so they aren't duplicated on this page.
 */
type EditableLabelKey = Exclude<
  keyof DocumentTemplateText,
  | 'discountLabel'
  | 'documentNumberLabel'
  | 'pendingDocumentNumberLabel'
  | 'noItemsLabel'
  | 'installmentSectionLabel'
  | 'installmentNoLabel'
  | 'installmentDetailLabel'
>

const EDITABLE_LABEL_FIELDS: { key: EditableLabelKey; title: string }[] = [
  { key: 'customerLabel', title: 'ลูกค้า' },
  { key: 'itemDescriptionLabel', title: 'หัวคอลัมน์: รายการ' },
  { key: 'itemQuantityLabel', title: 'หัวคอลัมน์: จำนวน' },
  { key: 'itemUnitPriceLabel', title: 'หัวคอลัมน์: ราคา/หน่วย' },
  { key: 'itemAmountLabel', title: 'หัวคอลัมน์: จำนวนเงิน' },
  { key: 'subtotalLabel', title: 'รวมเป็นเงิน' },
  { key: 'vatLabel', title: 'ภาษีมูลค่าเพิ่ม' },
  { key: 'grandTotalLabel', title: 'ยอดรวมทั้งสิ้น' },
  { key: 'issueDateLabel', title: 'วันที่ออกเอกสาร' },
  { key: 'dueDateLabel', title: 'ครบกำหนด' },
  { key: 'noteLabel', title: 'หมายเหตุ' },
]

const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'RFQ',
  'QUOTATION',
  'INVOICE',
  'TAX_INVOICE',
  'RECEIPT',
  'RECEIPT_TAX_INVOICE',
  'CREDIT_NOTE',
  'CREDIT_NOTE_TAX',
]

type LabelValues = Partial<Record<EditableLabelKey, string>>
type TitleValues = Partial<Record<DocumentType, string>>

function labelValuesFrom(overrides: DocumentTemplateTextOverrides | undefined): LabelValues {
  const values: LabelValues = {}
  for (const { key } of EDITABLE_LABEL_FIELDS) {
    const value = overrides?.labels?.[key]
    if (value) values[key] = value
  }
  return values
}

function titleValuesFrom(overrides: DocumentTemplateTextOverrides | undefined): TitleValues {
  const values: TitleValues = {}
  for (const type of DOCUMENT_TYPE_ORDER) {
    const value = overrides?.documentTypeTitles?.[type]
    if (value) values[type] = value
  }
  return values
}

/** Drops blank entries entirely (rather than saving empty strings) so a cleared field reverts to the default and doesn't bloat the stored JSON. */
function buildOverridesPayload(labelValues: LabelValues, titleValues: TitleValues): DocumentTemplateTextOverrides {
  const labels: Partial<DocumentTemplateText> = {}
  for (const { key } of EDITABLE_LABEL_FIELDS) {
    const trimmed = labelValues[key]?.trim()
    if (trimmed) labels[key] = trimmed
  }

  const documentTypeTitles: TitleValues = {}
  for (const type of DOCUMENT_TYPE_ORDER) {
    const trimmed = titleValues[type]?.trim()
    if (trimmed) documentTypeTitles[type] = trimmed
  }

  const result: DocumentTemplateTextOverrides = {}
  if (Object.keys(labels).length > 0) result.labels = labels
  if (Object.keys(documentTypeTitles).length > 0) result.documentTypeTitles = documentTypeTitles
  return result
}

export function TemplateTextSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const setCompany = useCompanyStore((state) => state.setCompany)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [labelValues, setLabelValues] = useState<LabelValues>({})
  const [titleValues, setTitleValues] = useState<TitleValues>({})
  const [isSaving, setIsSaving] = useState(false)

  // Resyncs whenever the store's own value changes — on first load, and
  // right after this page's own save below updates the store — same
  // pattern as CompanySettingsPage's logoSize/logoPosition resync.
  useEffect(() => {
    if (!company) return
    setLabelValues(labelValuesFrom(company.templateTextOverrides))
    setTitleValues(titleValuesFrom(company.templateTextOverrides))
  }, [company])

  if (!company) {
    return <ErrorState title="ไม่พบข้อมูลบริษัท" onRetry={() => window.location.reload()} />
  }

  const isDirty =
    JSON.stringify(labelValues) !== JSON.stringify(labelValuesFrom(company.templateTextOverrides)) ||
    JSON.stringify(titleValues) !== JSON.stringify(titleValuesFrom(company.templateTextOverrides))

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const overrides = buildOverridesPayload(labelValues, titleValues)
      const updated = await updateCompanyTemplateText(company.id, overrides)
      setCompany(updated)
      if (user) {
        void logAuditEvent({
          companyId: updated.id,
          actorId: user.id,
          action: 'UPDATE_TEMPLATE_TEXT',
          entityType: 'company',
          entityId: updated.id,
        })
      }
      toast({ title: 'บันทึกข้อความในเอกสารสำเร็จ', tone: 'success' })
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
        ปรับข้อความป้ายกำกับที่แสดงในตัวอย่างเอกสารและไฟล์ PDF ทุก Template — เว้นว่างช่องใดไว้จะใช้ข้อความเริ่มต้นของระบบ
        ลายเซ็นเอกสารตั้งค่าแยกต่างหากที่ Settings &gt; ลายเซ็นเอกสาร
      </PhaseNotice>

      {!isOwner && <PhaseNotice>คุณมีสิทธิ์ดูข้อความในเอกสารเท่านั้น — เฉพาะเจ้าของบริษัทที่แก้ไขได้</PhaseNotice>}

      <fieldset disabled={!isOwner} className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <p className="font-medium text-ink">ชื่อประเภทเอกสาร</p>
          <p className="mt-1 text-sm text-ink-muted">ข้อความหัวเอกสารที่พิมพ์กำกับแต่ละประเภทเอกสาร เช่น ใบเสนอราคา, ใบแจ้งหนี้</p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DOCUMENT_TYPE_ORDER.map((type) => (
              <FormField key={type} label={documentTypeLabels[type]} htmlFor={`doc-type-title-${type}`}>
                <Input
                  id={`doc-type-title-${type}`}
                  value={titleValues[type] ?? ''}
                  onChange={(e) => setTitleValues((prev) => ({ ...prev, [type]: e.target.value }))}
                  placeholder={documentTypeLabels[type]}
                />
              </FormField>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <p className="font-medium text-ink">ป้ายกำกับในเอกสาร</p>
          <p className="mt-1 text-sm text-ink-muted">ข้อความป้ายกำกับลูกค้า/รายการ/ยอดรวม/วันที่/หมายเหตุ ที่แสดงในทั้ง 3 Template</p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EDITABLE_LABEL_FIELDS.map(({ key, title }) => (
              <FormField key={key} label={title} htmlFor={`label-${key}`}>
                <Input
                  id={`label-${key}`}
                  value={labelValues[key] ?? ''}
                  onChange={(e) => setLabelValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={DEFAULT_DOCUMENT_TEMPLATE_TEXT[key]}
                />
              </FormField>
            ))}
          </div>
        </div>
      </fieldset>

      {isOwner && (
        <div className="flex justify-end">
          <Button type="button" isLoading={isSaving} disabled={!isDirty} onClick={() => void handleSave()}>
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      )}
    </div>
  )
}
