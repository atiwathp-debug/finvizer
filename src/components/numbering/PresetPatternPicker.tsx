import { CheckCircle2, Sparkles } from 'lucide-react'
import {
  NUMBERING_PRESET_PATTERNS,
  renderPatternPreview,
  type PatternPreviewContext,
} from '@/lib/validations/numberingPattern'
import { cn } from '@/lib/utils/cn'

interface PresetPatternPickerProps {
  /** null when the custom option is selected instead of a preset. */
  selectedPattern: string | null
  isCustomMode: boolean
  context: PatternPreviewContext
  disabled?: boolean
  onSelectPreset: (pattern: string) => void
  onSelectCustom: () => void
}

export function PresetPatternPicker({
  selectedPattern,
  isCustomMode,
  context,
  disabled = false,
  onSelectPreset,
  onSelectCustom,
}: PresetPatternPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {NUMBERING_PRESET_PATTERNS.map((pattern) => {
        const isSelected = !isCustomMode && selectedPattern === pattern
        return (
          <button
            key={pattern}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPreset(pattern)}
            className={cn(
              'rounded-xl border-2 p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              isSelected ? 'border-brand-500 bg-brand-50/40' : 'border-line bg-white hover:border-brand-200',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <code className="text-xs text-ink-muted">{pattern}</code>
              {isSelected && (
                <CheckCircle2 className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
              )}
            </div>
            <p className="mt-2 font-mono text-sm font-medium text-ink">
              {renderPatternPreview(pattern, context)}
            </p>
          </button>
        )
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={onSelectCustom}
        className={cn(
          'rounded-xl border-2 p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          isCustomMode ? 'border-brand-500 bg-brand-50/40' : 'border-line bg-white hover:border-brand-200',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
            กำหนดเอง (Custom Pattern)
          </span>
          {isCustomMode && <CheckCircle2 className="size-4 shrink-0 text-brand-600" aria-hidden="true" />}
        </div>
        <p className="mt-2 text-xs text-ink-muted">เลือก token เองเพื่อสร้างรูปแบบเลขที่เอกสารที่ต้องการ</p>
      </button>
    </div>
  )
}
