import { Plus, X } from 'lucide-react'
import { numberingTokenCatalog, type NumberingToken } from '@/lib/validations/numberingPattern'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

interface CustomPatternBuilderProps {
  tokens: string[]
  disabled?: boolean
  /**
   * Takes a functional updater, like `setState` — required so that
   * clicking multiple token buttons in quick succession (all within the
   * same React batch) each apply against the *latest* pending tokens
   * array instead of the stale `tokens` prop every handler in that batch
   * originally closed over, which would otherwise silently drop all but
   * the last click's token.
   */
  onChange: (updater: (prev: string[]) => string[]) => void
}

export function CustomPatternBuilder({ tokens, disabled = false, onChange }: CustomPatternBuilderProps) {
  const addToken = (token: NumberingToken) => onChange((prev) => [...prev, token])
  const removeTokenAt = (index: number) => onChange((prev) => prev.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-muted">รูปแบบที่เลือก (คั่นด้วย "-" อัตโนมัติ)</p>
        {tokens.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted">
            แตะ token ด้านล่างเพื่อเริ่มสร้างรูปแบบ
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tokens.map((token, index) => (
              <span key={`${token}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <span className="text-ink-muted">-</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs font-medium text-brand-700">
                  {token}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeTokenAt(index)}
                    aria-label={`ลบ ${token}`}
                    className="rounded-full p-0.5 hover:bg-brand-100 disabled:pointer-events-none"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-ink-muted">Token ที่ใช้ได้</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {numberingTokenCatalog.map((meta) => (
            <button
              key={meta.token}
              type="button"
              disabled={disabled || meta.comingSoon}
              onClick={() => addToken(meta.token)}
              title={meta.label}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-xs text-ink transition-colors',
                'hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent',
              )}
            >
              <Plus className="size-3" aria-hidden="true" />
              {meta.token}
              {meta.comingSoon && (
                <Badge tone="warning" className="ml-0.5">
                  เร็ว ๆ นี้
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {tokens.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(() => [])}
          className="text-xs font-medium text-ink-muted underline hover:text-ink disabled:pointer-events-none"
        >
          ล้างทั้งหมด
        </button>
      )}
    </div>
  )
}
