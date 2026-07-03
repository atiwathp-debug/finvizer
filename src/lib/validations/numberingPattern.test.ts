import { describe, expect, it } from 'vitest'
import {
  buildPattern,
  renderPatternPreview,
  validateNumberingPattern,
  type PatternPreviewContext,
} from './numberingPattern'

const context: PatternPreviewContext = {
  companyCode: 'DEMO',
  branchCode: 'HQ',
  docTypeCode: 'QO',
  customerCode: 'ORCHID',
  date: new Date('2026-07-01T00:00:00'),
}

describe('buildPattern', () => {
  it('joins tokens with a fixed "-" separator', () => {
    expect(buildPattern(['{DOC_TYPE}', '{YYYY}', '{RUNNING:4}'])).toBe(
      '{DOC_TYPE}-{YYYY}-{RUNNING:4}',
    )
  })
})

describe('renderPatternPreview', () => {
  it('renders the 4 preset patterns exactly as specified', () => {
    expect(renderPatternPreview('{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}', context)).toBe(
      'QO-20260701-0001',
    )
    expect(
      renderPatternPreview('{COMPANY_CODE}-{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}', context),
    ).toBe('DEMO-QO-20260701-0001')
    expect(
      renderPatternPreview('{COMPANY_CODE}-{BRANCH_CODE}-{DOC_TYPE}-{YY}{MM}-{RUNNING:4}', context),
    ).toBe('DEMO-HQ-QO-2607-0001')
    expect(renderPatternPreview('{DOC_TYPE}-{CUSTOMER_CODE}-{YYYY}-{RUNNING:4}', context)).toBe(
      'QO-ORCHID-2026-0001',
    )
  })

  it('pads the running number to the requested width', () => {
    expect(renderPatternPreview('{RUNNING:3}', context)).toBe('001')
    expect(renderPatternPreview('{RUNNING:5}', context)).toBe('00001')
  })

  it('defaults runningNumber to 1 for illustrative previews', () => {
    expect(renderPatternPreview('{RUNNING:4}', context)).toBe('0001')
  })

  it('uses a real runningNumber when Phase 2C generation supplies one', () => {
    expect(renderPatternPreview('{RUNNING:4}', { ...context, runningNumber: 42 })).toBe('0042')
    expect(renderPatternPreview('{DOC_TYPE}-{RUNNING:3}', { ...context, runningNumber: 7 })).toBe(
      'QO-007',
    )
    expect(renderPatternPreview('{RUNNING:3}', { ...context, runningNumber: 1000 })).toBe('1000')
  })

  it('falls back to a generic sample when customerCode is not provided', () => {
    expect(renderPatternPreview('{CUSTOMER_CODE}', { ...context, customerCode: undefined })).toBe(
      'CUSTCODE',
    )
  })
})

describe('validateNumberingPattern', () => {
  it('accepts all 4 preset patterns', () => {
    const presets = [
      '{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}',
      '{COMPANY_CODE}-{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}',
      '{COMPANY_CODE}-{BRANCH_CODE}-{DOC_TYPE}-{YY}{MM}-{RUNNING:4}',
      '{DOC_TYPE}-{CUSTOMER_CODE}-{YYYY}-{RUNNING:4}',
    ]
    for (const pattern of presets) {
      const result = validateNumberingPattern(pattern, context)
      expect(result.errors).toEqual([])
      expect(result.valid).toBe(true)
    }
  })

  it('rejects an empty pattern', () => {
    const result = validateNumberingPattern('', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('กรุณาเลือกอย่างน้อย 1 token')
  })

  it('requires {DOC_TYPE}', () => {
    const result = validateNumberingPattern('{YYYY}-{RUNNING:4}', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('ต้องมี {DOC_TYPE} ในรูปแบบเลขที่เอกสาร')
  })

  it('requires exactly one {RUNNING:n} — none is an error', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{YYYY}', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('ต้องมีเลขรัน {RUNNING:n} อย่างน้อย 1 ตำแหน่ง')
  })

  it('requires exactly one {RUNNING:n} — two is an error', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{YYYY}-{RUNNING:3}-{RUNNING:4}', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('ใส่เลขรัน {RUNNING:n} ได้เพียงตำแหน่งเดียว')
  })

  it('requires at least {YYYY} or {YY}', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{RUNNING:4}', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('ต้องมี {YYYY} หรือ {YY} อย่างน้อย 1 ตำแหน่ง')
  })

  it('accepts {YY} as satisfying the year requirement', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{YY}-{RUNNING:4}', context)
    expect(result.errors).toEqual([])
  })

  it('rejects raw characters outside of tokens and the "-" separator', () => {
    const result = validateNumberingPattern('ABC{DOC_TYPE}-{YYYY}-{RUNNING:4}', context)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'รูปแบบมีอักขระที่ไม่รองรับ (อนุญาตเฉพาะ A-Z, 0-9, "-" และ token ที่กำหนด)',
    )
  })

  it('rejects an unsupported token', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{YYYY}-{RUNNING:4}-{FOO}', context)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('{FOO}'))).toBe(true)
  })

  it('rejects {PROJECT_CODE} as not yet available', () => {
    const result = validateNumberingPattern(
      '{DOC_TYPE}-{PROJECT_CODE}-{YYYY}-{RUNNING:4}',
      context,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('{PROJECT_CODE}'))).toBe(true)
  })

  it('rejects a pattern whose rendered preview exceeds 64 characters', () => {
    // 6 long tokens joined with "-" comfortably exceeds 64 rendered chars.
    const pattern = buildPattern([
      '{COMPANY_CODE}',
      '{BRANCH_CODE}',
      '{DOC_TYPE}',
      '{CUSTOMER_CODE}',
      '{YYYY}',
      '{MM}',
      '{DD}',
      '{RUNNING:5}',
      '{YY}',
      '{MM}',
    ])
    const result = validateNumberingPattern(pattern, {
      ...context,
      companyCode: 'VERYLONGCOMPANYCODE',
      branchCode: 'VERYLONGBRANCHCODE',
      customerCode: 'VERYLONGCUSTOMERCODE',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('ยาวเกินไป'))).toBe(true)
  })

  it('warns (without blocking) when {CUSTOMER_CODE} is used', () => {
    const result = validateNumberingPattern(
      '{DOC_TYPE}-{CUSTOMER_CODE}-{YYYY}-{RUNNING:4}',
      context,
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(1)
  })

  it('does not warn when {CUSTOMER_CODE} is absent', () => {
    const result = validateNumberingPattern('{DOC_TYPE}-{YYYY}-{RUNNING:4}', context)
    expect(result.warnings).toEqual([])
  })
})
