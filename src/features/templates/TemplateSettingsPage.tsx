import { useState } from 'react'
import { documentTemplateCatalog } from '@/types/documentTemplate'
import { updateCompanyTemplate } from '@/lib/supabase/company'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { TemplateSelectionCard } from '@/components/templates/TemplateSelectionCard'
import { FullTemplatePreviewDialog } from '@/components/templates/FullTemplatePreviewDialog'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { ErrorState } from '@/components/shared/ErrorState'
import { toast } from '@/stores/toastStore'
import type { DocumentTemplateEnum } from '@/types/database'
import type { DocumentTemplateMeta } from '@/types/documentTemplate'

export function TemplateSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const company = useCompanyStore((state) => state.company)
  const setCompany = useCompanyStore((state) => state.setCompany)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateMeta | null>(null)
  const [savingId, setSavingId] = useState<DocumentTemplateEnum | null>(null)

  if (!company) {
    return <ErrorState title="ไม่พบข้อมูลบริษัท" onRetry={() => window.location.reload()} />
  }

  const handleSelect = async (templateId: DocumentTemplateEnum) => {
    if (savingId || !user) return
    setSavingId(templateId)
    try {
      const updated = await updateCompanyTemplate(company.id, templateId)
      setCompany(updated)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'CHANGE_DOCUMENT_TEMPLATE',
        entityType: 'company',
        entityId: company.id,
        metadata: { template: templateId },
      })
      toast({ title: 'เปลี่ยน Template สำเร็จ', tone: 'success' })
      setPreviewTemplate(null)
    } catch (error) {
      toast({
        title: 'เปลี่ยน Template ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!isOwner && (
        <PhaseNotice>คุณมีสิทธิ์ดู Template เท่านั้น — เฉพาะเจ้าของบริษัทที่เปลี่ยนได้</PhaseNotice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
