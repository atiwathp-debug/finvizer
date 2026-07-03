import { describe, expect, it } from 'vitest'
import { sanitizeText } from './sanitizeText'

describe('sanitizeText', () => {
  it('returns an empty string for null/undefined/empty input', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
    expect(sanitizeText('')).toBe('')
  })

  it('passes ordinary Thai and English text through unchanged', () => {
    expect(sanitizeText('บริษัท ทดสอบ จำกัด (Test Co., Ltd.) — 100%')).toBe(
      'บริษัท ทดสอบ จำกัด (Test Co., Ltd.) — 100%',
    )
  })

  it('strips control characters (null bytes, form feeds) without touching normal whitespace between words', () => {
    expect(sanitizeText('หมายเหตุ\x00ชำระ\x0cภายใน 15 วัน')).toBe('หมายเหตุชำระภายใน 15 วัน')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  ค่าบริการ  ')).toBe('ค่าบริการ')
  })

  it('truncates pathologically long input with an ellipsis', () => {
    const long = 'ก'.repeat(3000)
    const result = sanitizeText(long)
    expect(result.length).toBe(2001) // 2000 chars + ellipsis marker
    expect(result.endsWith('…')).toBe(true)
  })

  it('leaves a script-like string as inert plain text (no HTML is ever parsed downstream)', () => {
    // react-pdf's <Text> renders this as literal characters, not markup —
    // sanitizeText only needs to strip control chars, not HTML-escape.
    expect(sanitizeText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })
})
