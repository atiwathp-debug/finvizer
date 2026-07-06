import { cn } from '@/lib/utils/cn'
import { clampLogoSize } from '@/types/logoLayout'

interface CompanyLogoProps {
  logoUrl: string | null | undefined
  /** Side length of the square bounding box, in px — clamped to the safe [LOGO_SIZE_MIN, LOGO_SIZE_MAX] range. */
  size: number
  className?: string
  grayscale?: boolean
}

/**
 * Renders the company logo inside a fixed square box (aspect ratio
 * preserved via `object-contain`, so a non-square logo never stretches
 * or overflows the box regardless of the configured size) — the single
 * shared renderer for the on-screen document preview, the template
 * picker mockups, and the print/export view, so all always agree on how
 * the logo looks.
 */
export function CompanyLogo({ logoUrl, size, className, grayscale = false }: CompanyLogoProps) {
  if (!logoUrl) return null
  const px = clampLogoSize(size)
  return (
    <img
      src={logoUrl}
      alt=""
      style={{ width: px, height: px }}
      className={cn('shrink-0 object-contain', grayscale && 'grayscale', className)}
    />
  )
}
