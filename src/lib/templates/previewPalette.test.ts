import { describe, expect, it } from 'vitest'
import { getTemplatePalette } from './previewPalette'

describe('getTemplatePalette', () => {
  it('returns a distinct palette for each of the 3 built-in templates', () => {
    const executive = getTemplatePalette('EXECUTIVE_CLASSIC')
    const modern = getTemplatePalette('MODERN_ACCENT')
    const minimal = getTemplatePalette('MINIMAL_PRINT')

    expect(executive.header).not.toBe(modern.header)
    expect(executive.header).not.toBe(minimal.header)
    expect(modern.header).not.toBe(minimal.header)
  })

  it('gives MINIMAL_PRINT a header border instead of a filled background', () => {
    const minimal = getTemplatePalette('MINIMAL_PRINT')
    expect(minimal.headerBorderColor).toBeDefined()
    expect(minimal.header).toBe('#ffffff')
  })

  it('never lets the grand-total text color match its own background (no invisible text)', () => {
    for (const template of ['EXECUTIVE_CLASSIC', 'MODERN_ACCENT', 'MINIMAL_PRINT'] as const) {
      const palette = getTemplatePalette(template)
      expect(palette.grandTotalTextColor).not.toBe(palette.totalBg)
    }
  })

  it('falls back to EXECUTIVE_CLASSIC when given null or undefined', () => {
    expect(getTemplatePalette(null)).toEqual(getTemplatePalette('EXECUTIVE_CLASSIC'))
    expect(getTemplatePalette(undefined)).toEqual(getTemplatePalette('EXECUTIVE_CLASSIC'))
  })
})
