import { useRef } from 'react'
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { isMockMode } from '@/lib/supabase/client'
import { LOGO_ALLOWED_MIME_TYPES } from '@/lib/supabase/company'

interface LogoUploadFieldProps {
  logoUrl: string | null
  disabled?: boolean
  isUploading?: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}

/** Real logo upload/remove UI — replaces the disabled LogoUploadPlaceholder. */
export function LogoUploadField({ logoUrl, disabled, isUploading, onUpload, onRemove }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUpload(file)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface text-ink-muted">
        {logoUrl ? (
          <img src={logoUrl} alt="โลโก้บริษัท" className="size-full object-contain" />
        ) : (
          <ImageIcon className="size-6" aria-hidden="true" />
        )}
      </div>
      <div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            isLoading={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            อัปโหลดโลโก้
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || isUploading} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              ลบโลโก้
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {isMockMode
            ? 'ในโหมด Mock โลโก้จะถูกบันทึกในเบราว์เซอร์ของคุณเท่านั้น (ขนาดไม่เกิน 500KB)'
            : 'รองรับไฟล์ PNG, JPG, SVG, WEBP ขนาดไม่เกิน 2MB'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ALLOWED_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
