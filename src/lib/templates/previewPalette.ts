import type { DocumentTemplateEnum } from '@/types/database'

export interface TemplatePalette {
  header: string
  headerText: string
  accent: string
  totalBg: string
  /**
   * Only set for templates with no header background fill (Minimal
   * Print) — a colored header block would defeat the "black-line only,
   * no color" point of that style, so it draws a border around the
   * header instead of filling it.
   */
  headerBorderColor?: string
  /**
   * Text color for the grand-total box. Separate from `header` because
   * the grand-total box always assumes `header` is a dark color it can
   * safely use as high-contrast text against `totalBg` (a light tint) —
   * true for EXECUTIVE_CLASSIC/MODERN_ACCENT, but MINIMAL_PRINT's
   * `header` is white, which would render invisible white-on-white text
   * if reused here.
   */
  grandTotalTextColor: string
}

/**
 * Shared between the on-screen preview (DocumentPreview.tsx) and the PDF
 * export (DocumentPdf.tsx) so both always render the exact same colors
 * for a given template. EXECUTIVE_CLASSIC/MODERN_ACCENT values are
 * unchanged from before this file existed (value-preserving refactor);
 * MINIMAL_PRINT is the new third template (production readiness pass 2).
 */
export const documentTemplatePalette: Record<DocumentTemplateEnum, TemplatePalette> = {
  EXECUTIVE_CLASSIC: {
    header: '#0f172a',
    headerText: '#ffffff',
    accent: '#334155',
    totalBg: '#f1f5f9',
    grandTotalTextColor: '#0f172a',
  },
  MODERN_ACCENT: {
    header: '#4f46e5',
    headerText: '#ffffff',
    accent: '#059669',
    totalBg: '#ecfdf5',
    grandTotalTextColor: '#4f46e5',
  },
  MINIMAL_PRINT: {
    header: '#ffffff',
    headerText: '#000000',
    accent: '#000000',
    totalBg: '#ffffff',
    headerBorderColor: '#000000',
    grandTotalTextColor: '#000000',
  },
}

export function getTemplatePalette(template: DocumentTemplateEnum | null | undefined): TemplatePalette {
  return documentTemplatePalette[template ?? 'EXECUTIVE_CLASSIC'] ?? documentTemplatePalette.EXECUTIVE_CLASSIC
}
