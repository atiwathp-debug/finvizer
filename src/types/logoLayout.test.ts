import { describe, expect, it } from 'vitest'
import {
  LOGO_SIZE_DEFAULT,
  LOGO_SIZE_MAX,
  LOGO_SIZE_MIN,
  clampLogoSize,
  isCenteredCompanyHeader,
  shouldRenderLogoAtSlot,
  type LogoPosition,
} from './logoLayout'

describe('clampLogoSize', () => {
  it('leaves an in-range value unchanged', () => {
    expect(clampLogoSize(64)).toBe(64)
  })

  it('clamps a value below the minimum up to LOGO_SIZE_MIN', () => {
    expect(clampLogoSize(0)).toBe(LOGO_SIZE_MIN)
    expect(clampLogoSize(-10)).toBe(LOGO_SIZE_MIN)
  })

  it('clamps a value above the maximum down to LOGO_SIZE_MAX (200)', () => {
    expect(LOGO_SIZE_MAX).toBe(200)
    expect(clampLogoSize(9999)).toBe(200)
    expect(clampLogoSize(201)).toBe(200)
  })

  it('leaves 200 itself unchanged (upper boundary)', () => {
    expect(clampLogoSize(200)).toBe(200)
  })

  it('rounds a fractional value', () => {
    expect(clampLogoSize(48.6)).toBe(49)
  })

  it('falls back to the default for NaN/Infinity', () => {
    expect(clampLogoSize(NaN)).toBe(LOGO_SIZE_DEFAULT)
    expect(clampLogoSize(Infinity)).toBe(LOGO_SIZE_DEFAULT)
  })
})

describe('shouldRenderLogoAtSlot', () => {
  const positions: LogoPosition[] = [
    'left_of_company_name',
    'header_left',
    'header_center',
    'header_right',
    'centered_logo_above_company',
    'hidden',
  ]
  const noSlotPositions: LogoPosition[] = ['hidden', 'centered_logo_above_company']

  it('hidden never renders at any slot', () => {
    for (const slot of ['left', 'center', 'right'] as const) {
      expect(shouldRenderLogoAtSlot('hidden', slot)).toBe(false)
    }
  })

  it('centered_logo_above_company never renders through the per-slot mechanism (it has its own dedicated stacked header)', () => {
    for (const slot of ['left', 'center', 'right'] as const) {
      expect(shouldRenderLogoAtSlot('centered_logo_above_company', slot)).toBe(false)
    }
  })

  it('left_of_company_name (the default) still renders only at the left slot', () => {
    expect(shouldRenderLogoAtSlot('left_of_company_name', 'left')).toBe(true)
    expect(shouldRenderLogoAtSlot('left_of_company_name', 'center')).toBe(false)
    expect(shouldRenderLogoAtSlot('left_of_company_name', 'right')).toBe(false)
  })

  it('left_of_company_name and header_left both render only at the left slot', () => {
    for (const position of ['left_of_company_name', 'header_left'] as const) {
      expect(shouldRenderLogoAtSlot(position, 'left')).toBe(true)
      expect(shouldRenderLogoAtSlot(position, 'center')).toBe(false)
      expect(shouldRenderLogoAtSlot(position, 'right')).toBe(false)
    }
  })

  it('header_center renders only at the center slot', () => {
    expect(shouldRenderLogoAtSlot('header_center', 'left')).toBe(false)
    expect(shouldRenderLogoAtSlot('header_center', 'center')).toBe(true)
    expect(shouldRenderLogoAtSlot('header_center', 'right')).toBe(false)
  })

  it('header_right renders only at the right slot', () => {
    expect(shouldRenderLogoAtSlot('header_right', 'left')).toBe(false)
    expect(shouldRenderLogoAtSlot('header_right', 'center')).toBe(false)
    expect(shouldRenderLogoAtSlot('header_right', 'right')).toBe(true)
  })

  it('exactly one slot is true per position (except hidden/centered_logo_above_company, which are all false)', () => {
    for (const position of positions) {
      const trueCount = (['left', 'center', 'right'] as const).filter((slot) =>
        shouldRenderLogoAtSlot(position, slot),
      ).length
      expect(trueCount).toBe(noSlotPositions.includes(position) ? 0 : 1)
    }
  })
})

describe('isCenteredCompanyHeader', () => {
  it('is true only for centered_logo_above_company', () => {
    expect(isCenteredCompanyHeader('centered_logo_above_company')).toBe(true)
  })

  it('is false for every other position, including hidden', () => {
    const others: LogoPosition[] = ['left_of_company_name', 'header_left', 'header_center', 'header_right', 'hidden']
    for (const position of others) {
      expect(isCenteredCompanyHeader(position)).toBe(false)
    }
  })
})
