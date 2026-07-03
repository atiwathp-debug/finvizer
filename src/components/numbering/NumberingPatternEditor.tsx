import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PresetPatternPicker } from '@/components/numbering/PresetPatternPicker'
import { CustomPatternBuilder } from '@/components/numbering/CustomPatternBuilder'
import {
  buildPattern,
  NUMBERING_PRESET_PATTERNS,
  validateNumberingPattern,
  type PatternPreviewContext,
} from '@/lib/validations/numberingPattern'
import { resetPolicyLabels, type ResetPolicy } from '@/types/numbering'
import { FormField } from '@/components/shared/FormField'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface NumberingPatternEditorProps {
  idPrefix: string
  initialPattern: string
  initialResetPolicy: ResetPolicy
  context: Omit<PatternPreviewContext, 'date'>
  disabled?: boolean
  isSaving?: boolean
  /**
   * True when there is no saved row yet (the caller is pre-filling a
   * suggested default rather than showing a previously-saved value) — in
   * that case Save must not require the draft to differ from the initial
   * value, since nothing has ever been persisted to differ from.
   */
  isNew?: boolean
  onSave: (pattern: string, resetPolicy: ResetPolicy) => void
}

const RESET_POLICIES: ResetPolicy[] = ['DAILY', 'MONTHLY', 'YEARLY', 'NEVER']

/**
 * Shared editor for both the company-wide default and a per-document-type
 * override — the caller is expected to remount this (via a changing
 * `key`) after a successful save, so its internal draft state resets to
 * the newly-saved values instead of staying "dirty".
 */
export function NumberingPatternEditor({
  idPrefix,
  initialPattern,
  initialResetPolicy,
  context,
  disabled = false,
  isSaving = false,
  isNew = false,
  onSave,
}: NumberingPatternEditorProps) {
  const isInitiallyPreset = (NUMBERING_PRESET_PATTERNS as readonly string[]).includes(initialPattern)
  const [mode, setMode] = useState<'preset' | 'custom'>(isInitiallyPreset ? 'preset' : 'custom')
  const [presetPattern, setPresetPattern] = useState<string | null>(
    isInitiallyPreset ? initialPattern : null,
  )
  const [customTokens, setCustomTokens] = useState<string[]>(
    isInitiallyPreset ? [] : initialPattern.split('-').filter(Boolean),
  )
  const [resetPolicy, setResetPolicy] = useState<ResetPolicy>(initialResetPolicy)

  const pattern = mode === 'preset' ? (presetPattern ?? '') : buildPattern(customTokens)
  const validation = validateNumberingPattern(pattern, context)
  const isDirty = pattern !== initialPattern || resetPolicy !== initialResetPolicy

  return (
    <div className="space-y-4">
      <PresetPatternPicker
        selectedPattern={presetPattern}
        isCustomMode={mode === 'custom'}
        context={context}
        disabled={disabled}
        onSelectPreset={(p) => {
          setMode('preset')
          setPresetPattern(p)
        }}
        onSelectCustom={() => setMode('custom')}
      />

      {mode === 'custom' && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <CustomPatternBuilder tokens={customTokens} disabled={disabled} onChange={setCustomTokens} />
        </div>
      )}

      <FormField label="รอบรีเซ็ตเลขรัน (Reset Policy)" htmlFor={`${idPrefix}-reset-policy`}>
        <Select
          id={`${idPrefix}-reset-policy`}
          value={resetPolicy}
          disabled={disabled}
          onChange={(e) => setResetPolicy(e.target.value as ResetPolicy)}
        >
          {RESET_POLICIES.map((policy) => (
            <option key={policy} value={policy}>
              {resetPolicyLabels[policy]}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-medium text-ink-muted">ตัวอย่างเลขที่เอกสาร</p>
        <p className="mt-1 font-mono text-lg font-semibold text-ink">{validation.preview || '—'}</p>
      </div>

      {validation.errors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {validation.errors.map((error) => (
            <p key={error} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ))}
        </div>
      )}

      {validation.warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </div>
      ))}

      {!disabled && (
        <div className="flex justify-end">
          <Button
            onClick={() => onSave(pattern, resetPolicy)}
            disabled={!validation.valid || (!isNew && !isDirty)}
            isLoading={isSaving}
          >
            บันทึกการตั้งค่า
          </Button>
        </div>
      )}
    </div>
  )
}
