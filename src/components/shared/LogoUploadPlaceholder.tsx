import { Image as ImageIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function LogoUploadPlaceholder() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-ink-muted">
        <ImageIcon className="size-6" aria-hidden="true" />
      </div>
      <div>
        <Button type="button" variant="secondary" size="sm" disabled>
          <Upload className="size-4" aria-hidden="true" />
          อัปโหลดโลโก้
        </Button>
        <p className="mt-1 text-xs text-ink-muted">อัปโหลดโลโก้ได้ภายหลังที่หน้าตั้งค่าบริษัท</p>
      </div>
    </div>
  )
}
