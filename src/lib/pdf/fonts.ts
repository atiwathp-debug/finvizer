import { Font } from '@react-pdf/renderer'
// WOFF (v1), not WOFF2: react-pdf 4.5.1's font subsetter (fontkit's glyph
// encoder) throws "Offset is outside the bounds of the DataView" inside
// EmbeddedFont.embed() when fed @fontsource's WOFF2 build of this font —
// reproduced directly against generateDocumentPdf(), unrelated to glyph
// count (this subset is only 130 glyphs). The WOFF1 build of the exact
// same subset embeds correctly through the identical pipeline, so that's
// what's registered here instead.
import notoSansThaiRegular from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff'
import notoSansThaiBold from '@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff'

export const THAI_FONT_FAMILY = 'NotoSansThai'

let registered = false

/**
 * Registers the Thai font family used by every PDF template. Only the
 * Thai-script subset is embedded (regular + bold) — Latin letters,
 * digits, and ordinary punctuation fall back to the PDF standard
 * "Helvetica" font (built into every PDF reader, needs no embedding) via
 * each Text style's `fontFamily: [THAI_FONT_FAMILY, 'Helvetica']` array,
 * which react-pdf resolves per-glyph. Thai currency symbol "฿" (U+0E3F)
 * is part of the Thai Unicode block, so it's covered by the Thai font
 * itself, not the Latin fallback.
 *
 * Idempotent — safe to call before every PDF generation without
 * re-registering (and re-fetching) the font on each export.
 */
export function registerPdfFonts(): void {
  if (registered) return
  Font.register({
    family: THAI_FONT_FAMILY,
    fonts: [
      { src: notoSansThaiRegular, fontWeight: 400 },
      { src: notoSansThaiBold, fontWeight: 700 },
    ],
  })
  registered = true
}
