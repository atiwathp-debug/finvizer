import { CheckCircle2, Eye } from 'lucide-react'
import { DocumentTemplatePreview } from '@/components/templates/DocumentTemplatePreview'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { DocumentTemplateMeta } from '@/types/documentTemplate'
import type { LogoPosition } from '@/types/logoLayout'

interface TemplateSelectionCardProps {
  template: DocumentTemplateMeta
  isSelected: boolean
  isSaving?: boolean
  /** True while a non-owner is viewing, or another card's save is in flight. */
  disabled?: boolean
  /** The signed-in company's real logo/layout settings, so this preview reflects what documents will actually look like. */
  logoUrl?: string | null
  logoSize?: number
  logoPosition?: LogoPosition
  onPreview: () => void
  onSelect: () => void
}

export function TemplateSelectionCard({
  template,
  isSelected,
  isSaving = false,
  disabled = false,
  logoUrl,
  logoSize,
  logoPosition,
  onPreview,
  onSelect,
}: TemplateSelectionCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-white p-5 transition-colors',
        isSelected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line',
      )}
    >
      <DocumentTemplatePreview
        variant={template.id}
        density="compact"
        logoUrl={logoUrl}
        logoSize={logoSize}
        logoPosition={logoPosition}
      />

      <div className="mt-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{template.name}</p>
          <p className="text-xs text-ink-muted">{template.tagline}</p>
        </div>
        {isSelected && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ใช้งานอยู่
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-ink-muted">{template.description}</p>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onPreview}>
          <Eye className="size-4" aria-hidden="true" />
          ดูตัวอย่างเต็ม
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={onSelect}
          disabled={isSelected || disabled}
          isLoading={isSaving}
        >
          {isSelected ? 'Template นี้ใช้งานอยู่' : 'เลือก Template นี้'}
        </Button>
      </div>
    </div>
  )
}
