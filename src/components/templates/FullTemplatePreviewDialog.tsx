import { DocumentTemplatePreview } from '@/components/templates/DocumentTemplatePreview'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { DocumentTemplateMeta } from '@/types/documentTemplate'
import type { LogoPosition } from '@/types/logoLayout'

interface FullTemplatePreviewDialogProps {
  /** null closes the dialog. */
  template: DocumentTemplateMeta | null
  onOpenChange: (open: boolean) => void
  isSelected: boolean
  isSaving?: boolean
  disabled?: boolean
  /** The signed-in company's real logo/layout settings, so this preview reflects what documents will actually look like. */
  logoUrl?: string | null
  logoSize?: number
  logoPosition?: LogoPosition
  onSelect: () => void
}

export function FullTemplatePreviewDialog({
  template,
  onOpenChange,
  isSelected,
  isSaving = false,
  disabled = false,
  logoUrl,
  logoSize,
  logoPosition,
  onSelect,
}: FullTemplatePreviewDialogProps) {
  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {template && (
          <>
            <DialogTitle>ตัวอย่างเต็ม — {template.name}</DialogTitle>
            <DialogDescription>{template.description}</DialogDescription>
            <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-xl border border-line bg-surface p-4">
              <DocumentTemplatePreview
                variant={template.id}
                density="full"
                logoUrl={logoUrl}
                logoSize={logoSize}
                logoPosition={logoPosition}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                ปิด
              </Button>
              <Button onClick={onSelect} disabled={isSelected || disabled} isLoading={isSaving}>
                {isSelected ? 'Template นี้ใช้งานอยู่' : 'เลือก Template นี้'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
