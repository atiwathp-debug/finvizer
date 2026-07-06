import { describe, expect, it } from 'vitest'
import { thaiBahtText } from './thaiBahtText'

describe('thaiBahtText', () => {
  it('reads a round number with no satang', () => {
    expect(thaiBahtText(1000)).toBe('หนึ่งพันบาทถ้วน')
  })

  it('reads baht and satang together', () => {
    expect(thaiBahtText(1070.5)).toBe('หนึ่งพันเจ็ดสิบบาทห้าสิบสตางค์')
  })

  it('applies เอ็ด for a trailing 1 and ยี่ for a leading 2 in the tens place', () => {
    expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน')
  })

  it('never says "หนึ่งสิบ" -- just "สิบ" alone', () => {
    expect(thaiBahtText(10)).toBe('สิบบาทถ้วน')
  })

  it('reads a lone 1 as หนึ่ง, not เอ็ด', () => {
    expect(thaiBahtText(1)).toBe('หนึ่งบาทถ้วน')
  })

  it('reads zero as ศูนย์บาทถ้วน', () => {
    expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน')
  })

  it('reads satang alone correctly, including เอ็ด/ยี่ rules', () => {
    expect(thaiBahtText(0.05)).toBe('ศูนย์บาทห้าสตางค์')
    expect(thaiBahtText(0.11)).toBe('ศูนย์บาทสิบเอ็ดสตางค์')
    expect(thaiBahtText(0.2)).toBe('ศูนย์บาทยี่สิบสตางค์')
  })

  it('reads amounts spanning ล้าน (million)', () => {
    expect(thaiBahtText(12000000)).toBe('สิบสองล้านบาทถ้วน')
  })

  it('clamps invalid/negative input to zero instead of crashing', () => {
    expect(thaiBahtText(Number.NaN)).toBe('ศูนย์บาทถ้วน')
    expect(thaiBahtText(-50)).toBe('ศูนย์บาทถ้วน')
  })
})
