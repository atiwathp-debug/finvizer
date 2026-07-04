import type { DocumentTemplateEnum } from '@/types/database'

export interface TemplatePalette {
  /**
   * This template's single accent/brand color — a solid dark fill behind
   * white text for the Formal template's header/totals box, a sparingly-
   * used bright accent for the Modern template's title/totals pill, or
   * pure black for the Minimal template (used identically for every line,
   * border, and letter — there is no second color).
   */
  accent: string
  /** Text color guaranteed readable when `accent` is used as a background fill. */
  accentText: string
}

/**
 * Shared between the on-screen preview (DocumentPreview.tsx) and the PDF
 * export (DocumentPdf.tsx) so both always use the exact same accent color
 * for a given template. As of production readiness pass 2's redesign, the
 * 3 templates are differentiated primarily by *layout structure* (each
 * has its own render path in both files) rather than by color alone — this
 * palette only supplies the one brand color each layout needs.
 */
export const documentTemplatePalette: Record<DocumentTemplateEnum, TemplatePalette> = {
  // Formal Thai business style — dark navy box fill, echoes traditional
  // Thai accounting-software forms (boxed header, boxed totals).
  EXECUTIVE_CLASSIC: {
    accent: '#1e3a5f',
    accentText: '#ffffff',
  },
  // Clean modern style — a single warm orange accent against an otherwise
  // all-white, spacious layout.
  MODERN_ACCENT: {
    accent: '#ea580c',
    accentText: '#ffffff',
  },
  // Minimal black-line official form — no color at all; accent doubles as
  // every border/line/letter.
  MINIMAL_PRINT: {
    accent: '#000000',
    accentText: '#ffffff',
  },
}

export function getTemplatePalette(template: DocumentTemplateEnum | null | undefined): TemplatePalette {
  return documentTemplatePalette[template ?? 'EXECUTIVE_CLASSIC'] ?? documentTemplatePalette.EXECUTIVE_CLASSIC
}
