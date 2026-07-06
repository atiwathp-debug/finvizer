import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCUMENT_TEMPLATE_TEXT,
  resolveDocumentTemplateText,
  resolveDocumentTypeLabel,
  type DocumentTemplateTextOverrides,
} from './documentTemplateText'
import { documentTypeLabels } from '@/types/document'

describe('resolveDocumentTemplateText', () => {
  it('returns the Thai defaults unchanged when there are no overrides', () => {
    expect(resolveDocumentTemplateText(undefined)).toEqual(DEFAULT_DOCUMENT_TEMPLATE_TEXT)
    expect(resolveDocumentTemplateText(null)).toEqual(DEFAULT_DOCUMENT_TEMPLATE_TEXT)
    expect(resolveDocumentTemplateText({})).toEqual(DEFAULT_DOCUMENT_TEMPLATE_TEXT)
  })

  it('applies only the overridden labels, leaving the rest at their defaults', () => {
    const overrides: DocumentTemplateTextOverrides = {
      labels: { customerLabel: 'ผู้ว่าจ้าง', vatLabel: 'ภาษีมูลค่าเพิ่ม 7%' },
    }
    const resolved = resolveDocumentTemplateText(overrides)
    expect(resolved.customerLabel).toBe('ผู้ว่าจ้าง')
    expect(resolved.vatLabel).toBe('ภาษีมูลค่าเพิ่ม 7%')
    expect(resolved.itemDescriptionLabel).toBe(DEFAULT_DOCUMENT_TEMPLATE_TEXT.itemDescriptionLabel)
    expect(resolved.grandTotalLabel).toBe(DEFAULT_DOCUMENT_TEMPLATE_TEXT.grandTotalLabel)
  })

  it('falls back to the default for a blank/whitespace-only override instead of shipping an empty label', () => {
    const resolved = resolveDocumentTemplateText({ labels: { noteLabel: '   ' } })
    expect(resolved.noteLabel).toBe(DEFAULT_DOCUMENT_TEMPLATE_TEXT.noteLabel)
  })

  it('trims a valid override before applying it', () => {
    const resolved = resolveDocumentTemplateText({ labels: { customerLabel: '  ผู้ซื้อสินค้า  ' } })
    expect(resolved.customerLabel).toBe('ผู้ซื้อสินค้า')
  })
})

describe('resolveDocumentTypeLabel', () => {
  it('returns the default document-type title when there are no overrides', () => {
    expect(resolveDocumentTypeLabel('QUOTATION', undefined)).toBe(documentTypeLabels.QUOTATION)
    expect(resolveDocumentTypeLabel('INVOICE', null)).toBe(documentTypeLabels.INVOICE)
    expect(resolveDocumentTypeLabel('TAX_INVOICE', {})).toBe(documentTypeLabels.TAX_INVOICE)
  })

  it('applies an override for the requested type only', () => {
    const overrides: DocumentTemplateTextOverrides = {
      documentTypeTitles: { QUOTATION: 'ใบเสนอราคา (ฉบับร่าง)' },
    }
    expect(resolveDocumentTypeLabel('QUOTATION', overrides)).toBe('ใบเสนอราคา (ฉบับร่าง)')
    expect(resolveDocumentTypeLabel('INVOICE', overrides)).toBe(documentTypeLabels.INVOICE)
  })

  it('falls back to the default for a blank override', () => {
    const overrides: DocumentTemplateTextOverrides = { documentTypeTitles: { RECEIPT: '   ' } }
    expect(resolveDocumentTypeLabel('RECEIPT', overrides)).toBe(documentTypeLabels.RECEIPT)
  })
})
