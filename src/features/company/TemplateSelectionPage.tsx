import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documentTemplateCatalog } from '@/types/documentTemplate'
import { updateCompanyTemplate } from '@/lib/supabase/company'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { deferNavigate } from '@/lib/utils/deferNavigate'
import { TemplateSelectionCard } from '@/components/templates/TemplateSelectionCard'
import { FullTemplatePreviewDialog } from '@/components/templates/FullTemplatePreviewDialog'
import { toast } from '@/stores/toastStore'
import type { DocumentTemplateEnum } from '@/types/database'
import type { DocumentTemplateMeta } from '@/types/documentTemplate'

export function TemplateSelectionPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const setCompany = useCompanyStore((state) => state.setCompany)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateMeta | null>(null)
  const [savingId, setSavingId] = useState<DocumentTemplateEnum | null>(null)

  if (!company || !user) return null

  const handleSelect = async (templateId: DocumentTemplateEnum) => {
    if (savingId) return
    setSavingId(templateId)
    try {
      const updated = await updateCompanyTemplate(company.id, templateId)
      // Clears RequireCompany's template gate before the explicit navigate
      // below, same reasoning as CompanyOnboardingPage's setCompanyAndRole
      // — see deferNavigate for why the ordering matters.
      setCompany(updated)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'SELECT_DOCUMENT_TEMPLATE',
        entityType: 'company',
        entityId: company.id,
        metadata: { template: templateId },
      })
      toast({ title: 'เลือก Template สำเร็จ', tone: 'success' })
      setPreviewTemplate(null)
      deferNavigate(navigate, '/dashboard')
    } catch (error) {
      toast({
        title: 'เลือก Template ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">เลือก Template เอกสาร</h1>
      <p className="mt-1 text-sm text-ink-muted">
        เลือกรูปแบบเอกสารเริ่มต้นสำหรับใบเสนอราคา ใบแจ้งหนี้ และเอกสารอื่น ๆ ของบริษัท — เปลี่ยนภายหลังได้ที่ Settings
        &gt; Template เอกสาร
      </p>

      {!isOwner && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          รอเจ้าของบริษัทเลือก Template เอกสารก่อนจึงจะเริ่มใช้งานได้ — คุณสามารถดูตัวอย่างได้ระหว่างนี้
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documentTemplateCatalog.map((template) => (
          <TemplateSelectionCard
            key={template.id}
            template={template}
            isSelected={template.id === company.documentTemplate}
            isSaving={savingId === template.id}
            disabled={!isOwner || (savingId !== null && savingId !== template.id)}
            onPreview={() => setPreviewTemplate(template)}
            onSelect={() => void handleSelect(template.id)}
          />
        ))}
      </div>

      <FullTemplatePreviewDialog
        template={previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        isSelected={previewTemplate?.id === company.documentTemplate}
        isSaving={previewTemplate !== null && savingId === previewTemplate.id}
        disabled={!isOwner}
        onSelect={() => previewTemplate && void handleSelect(previewTemplate.id)}
      />
    </div>
  )
}
