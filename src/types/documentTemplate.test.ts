import { describe, expect, it } from 'vitest'
import { documentTemplateCatalog, getDocumentTemplateMeta } from './documentTemplate'

describe('documentTemplateCatalog', () => {
  it('has exactly the 3 built-in templates', () => {
    expect(documentTemplateCatalog.map((t) => t.id)).toEqual([
      'EXECUTIVE_CLASSIC',
      'MODERN_ACCENT',
      'MINIMAL_PRINT',
    ])
  })
})

describe('getDocumentTemplateMeta', () => {
  it('returns the matching template', () => {
    expect(getDocumentTemplateMeta('MODERN_ACCENT').name).toBe('Modern Accent')
    expect(getDocumentTemplateMeta('EXECUTIVE_CLASSIC').name).toBe('Executive Classic')
  })
})
