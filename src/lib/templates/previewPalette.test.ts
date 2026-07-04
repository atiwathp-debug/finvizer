import { describe, expect, it } from 'vitest'
import { getTemplatePalette } from './previewPalette'

describe('getTemplatePalette', () => {
  it('returns a distinct accent color for each of the 3 built-in templates', () => {
    const executive = getTemplatePalette('EXECUTIVE_CLASSIC')
    const modern = getTemplatePalette('MODERN_ACCENT')
    const minimal = getTemplatePalette('MINIMAL_PRINT')

    expect(executive.accent).not.toBe(modern.accent)
    expect(executive.accent).not.toBe(minimal.accent)
    expect(modern.accent).not.toBe(minimal.accent)
  })

  it('gives MINIMAL_PRINT pure black as its only color', () => {
    expect(getTemplatePalette('MINIMAL_PRINT').accent).toBe('#000000')
  })

  it('never lets accentText match accent (no invisible text on a filled accent background)', () => {
    for (const template of ['EXECUTIVE_CLASSIC', 'MODERN_ACCENT', 'MINIMAL_PRINT'] as const) {
      const palette = getTemplatePalette(template)
      expect(palette.accentText).not.toBe(palette.accent)
    }
  })

  it('falls back to EXECUTIVE_CLASSIC when given null or undefined', () => {
    expect(getTemplatePalette(null)).toEqual(getTemplatePalette('EXECUTIVE_CLASSIC'))
    expect(getTemplatePalette(undefined)).toEqual(getTemplatePalette('EXECUTIVE_CLASSIC'))
  })
})
