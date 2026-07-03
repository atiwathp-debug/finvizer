import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockCompany } from './mockCompany'
import { saveMockNumberingSetting } from './mockNumbering'
import { createMockCustomer } from './mockCustomers'
import { listMockAuditLogsForEntity } from './mockAuditLogs'
import {
  approveMockDraftDocument,
  cancelMockDocument,
  createMockDocumentConversion,
  createMockDocumentRevision,
  createMockDraftDocument,
  deleteMockDraftDocument,
  getMockDocumentById,
  listMockDocumentConversions,
  listMockDocumentRevisions,
  listMockDocumentsForCompany,
  markMockDocumentPaid,
  saveMockDocumentDraft,
} from './mockDocuments'
import type { DocumentFormValues } from '@/lib/validations/document'
import type { DocumentRecord } from '@/types/document'

const companyInput = {
  nameTh: 'บริษัท เดโม เทรดดิ้ง จำกัด',
  nameEn: 'Demo Trading Co., Ltd.',
  companyCode: 'DEMO',
  taxId: '0105561000001',
  address: '99/9 ถนนสุขุมวิท กรุงเทพมหานคร',
  phone: '02-123-4567',
  email: 'contact@demotrading.example',
  contactName: 'สมชาย ใจดี',
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function setupCompany() {
  return createMockCompany('user-1', companyInput)
}

describe('createMockDraftDocument', () => {
  it('creates a Draft with no official document number', () => {
    const company = setupCompany()
    const doc = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(doc.status).toBe('DRAFT')
    expect(doc.documentNumber).toBeNull()
    expect(listMockDocumentsForCompany(company.id)).toHaveLength(1)
  })
})

describe('approveMockDraftDocument', () => {
  it('throws when the company has no numbering_settings configured', () => {
    const company = setupCompany()
    const doc = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(() => approveMockDraftDocument(doc.id, 'user-1')).toThrow(
      'บริษัทยังไม่ได้ตั้งค่ารูปแบบเลขที่เอกสาร',
    )
  })

  it('generates a document number and flips status to APPROVED', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const doc = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    const approved = approveMockDraftDocument(doc.id, 'user-1')

    expect(approved.status).toBe('APPROVED')
    expect(approved.documentNumber).toMatch(/^QO-\d{4}-0001$/)
    expect(approved.approvedBy).toBe('user-1')
    expect(approved.approvedAt).not.toBeNull()
  })

  it('requires a customer code when the pattern uses {CUSTOMER_CODE}', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{CUSTOMER_CODE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const doc = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(() => approveMockDraftDocument(doc.id, 'user-1')).toThrow(
      'รูปแบบเลขที่เอกสารนี้ต้องมีรหัสลูกค้า',
    )

    const docWithCustomer = createMockDraftDocument(company.id, 'QUOTATION', 'user-1', 'ORCHID')
    const approved = approveMockDraftDocument(docWithCustomer.id, 'user-1')
    expect(approved.documentNumber).toContain('ORCHID')
  })

  it('increments the running number within the same MONTHLY bucket', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}{MM}-{RUNNING:4}', 'MONTHLY')

    const first = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    const second = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(first.documentNumber).toMatch(/-0001$/)
    expect(second.documentNumber).toMatch(/-0002$/)
  })

  it('resets the running number on a new DAILY bucket but not within the same day', () => {
    vi.useFakeTimers()
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}', 'DAILY')

    vi.setSystemTime(new Date('2026-07-01T09:00:00'))
    const day1First = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    vi.setSystemTime(new Date('2026-07-01T15:00:00'))
    const day1Second = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    vi.setSystemTime(new Date('2026-07-02T09:00:00'))
    const day2First = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(day1First.documentNumber).toBe('QO-20260701-0001')
    expect(day1Second.documentNumber).toBe('QO-20260701-0002')
    expect(day2First.documentNumber).toBe('QO-20260702-0001')
  })

  it('resets the running number on a new YEARLY bucket but not within the same year', () => {
    vi.useFakeTimers()
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'YEARLY')

    vi.setSystemTime(new Date('2026-01-15T00:00:00'))
    const yearOneFirst = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    vi.setSystemTime(new Date('2026-11-30T00:00:00'))
    const yearOneSecond = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    vi.setSystemTime(new Date('2027-01-01T00:00:00'))
    const yearTwoFirst = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(yearOneFirst.documentNumber).toBe('QO-2026-0001')
    expect(yearOneSecond.documentNumber).toBe('QO-2026-0002')
    expect(yearTwoFirst.documentNumber).toBe('QO-2027-0001')
  })

  it('NEVER never resets, even across year boundaries', () => {
    vi.useFakeTimers()
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{RUNNING:4}', 'NEVER')

    vi.setSystemTime(new Date('2026-12-31T23:00:00'))
    const before = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    vi.setSystemTime(new Date('2027-01-01T01:00:00'))
    const after = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(before.documentNumber).toBe('QO-0001')
    expect(after.documentNumber).toBe('QO-0002')
  })

  it('gives each document type its own independent running counter', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')

    const quotation = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    const invoice = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'INVOICE', 'user-1').id,
      'user-1',
    )
    const secondQuotation = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(quotation.documentNumber).toMatch(/^QO-\d{4}-0001$/)
    expect(invoice.documentNumber).toMatch(/^IV-\d{4}-0001$/)
    expect(secondQuotation.documentNumber).toMatch(/^QO-\d{4}-0002$/)
  })

  it('applies a per-document-type override instead of the company default', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    saveMockNumberingSetting(company.id, 'INVOICE', '{COMPANY_CODE}-{DOC_TYPE}-{RUNNING:5}', 'NEVER')

    const quotation = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    const invoice = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'INVOICE', 'user-1').id,
      'user-1',
    )

    expect(quotation.documentNumber).toMatch(/^QO-\d{4}-0001$/)
    expect(invoice.documentNumber).toBe('DEMO-IV-00001')
  })

  it('retries and advances past a colliding document number', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')

    // Pre-seed an already-approved document occupying the number that
    // running_number=1 would otherwise produce, forcing the first attempt
    // inside approveMockDraftDocument to collide and retry.
    const colliding: DocumentRecord = {
      id: crypto.randomUUID(),
      companyId: company.id,
      documentType: 'QUOTATION',
      status: 'APPROVED',
      customerId: null,
      customerCode: null,
      documentNumber: 'QO-2026-0001',
      vatMode: 'VAT_EXCLUDED',
      issueDate: '2026-07-01',
      dueDate: null,
      note: null,
      documentDiscountType: 'AMOUNT',
      documentDiscountValue: 0,
      subtotal: 0,
      discountTotal: 0,
      vatAmount: 0,
      grandTotal: 0,
      items: [],
      createdBy: 'user-1',
      approvedBy: 'user-1',
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentDocumentId: null,
      revisionNo: null,
      sourceDocumentId: null,
    }
    localStorage.setItem(
      'finvizer_mock_documents',
      JSON.stringify([colliding]),
    )

    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')
    const approved = approveMockDraftDocument(draft.id, 'user-1')

    // Retried past the collision straight to the next number, not stuck.
    expect(approved.documentNumber).toBe('QO-2026-0002')

    // Confirm the sequence counter itself actually advanced by the retry
    // (not just reused) — the next fresh approval should get 0003.
    const next = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    expect(next.documentNumber).toBe('QO-2026-0003')
  })

  it('is not re-approvable — status and document_number become immutable', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')
    const approved = approveMockDraftDocument(draft.id, 'user-1')

    expect(() => approveMockDraftDocument(draft.id, 'user-1')).toThrow(
      'เอกสารนี้ไม่ได้อยู่ในสถานะฉบับร่าง ไม่สามารถอนุมัติซ้ำได้',
    )

    // The failed re-approval attempt must not have mutated the stored record.
    expect(getMockDocumentById(draft.id)).toEqual(approved)
  })

  it('throws for an unknown document id', () => {
    expect(() => approveMockDraftDocument('missing-id', 'user-1')).toThrow('ไม่พบเอกสาร')
  })
})

describe('deleteMockDraftDocument', () => {
  it('deletes a Draft without touching numbering (it never had a number)', () => {
    const company = setupCompany()
    const doc = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    deleteMockDraftDocument(doc.id)

    expect(listMockDocumentsForCompany(company.id)).toHaveLength(0)
  })

  it('refuses to delete an APPROVED document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    expect(() => deleteMockDraftDocument(approved.id)).toThrow(
      'ลบได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น',
    )
  })

  it('deleting a Draft never creates a gap — the next approval still starts at 0001', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')

    const draftToDelete = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')
    deleteMockDraftDocument(draftToDelete.id)

    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )
    expect(approved.documentNumber).toMatch(/-0001$/)
  })

  it('throws for an unknown document id', () => {
    expect(() => deleteMockDraftDocument('missing-id')).toThrow('ไม่พบเอกสาร')
  })
})

describe('saveMockDocumentDraft', () => {
  const customerInput = {
    customerCode: 'ORCHID',
    name: 'บริษัท ออร์คิด เดโม จำกัด',
    taxId: '',
    branch: '',
    address: '',
    phone: '',
    email: '',
    contactName: '',
    note: '',
  }

  const formInput: DocumentFormValues = {
    documentType: 'QUOTATION',
    customerId: 'placeholder', // overwritten per-test with the real customer id
    vatMode: 'VAT_EXCLUDED',
    issueDate: '2026-07-01',
    dueDate: '',
    note: '',
    documentDiscountType: 'AMOUNT',
    documentDiscountValue: 0,
    items: [
      { description: 'ค่าบริการที่ปรึกษา', quantity: 1, unit: 'งาน', unitPrice: 1000, discountType: 'AMOUNT', discountValue: 0 },
    ],
  }

  it('creates a new Draft with no official document number, computed totals, and items', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)

    const draft = saveMockDocumentDraft(null, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer)

    expect(draft.status).toBe('DRAFT')
    expect(draft.documentNumber).toBeNull()
    expect(draft.customerId).toBe(customer.id)
    expect(draft.customerCode).toBe('ORCHID')
    expect(draft.subtotal).toBe(1000)
    expect(draft.grandTotal).toBe(1070) // VAT_EXCLUDED: 1000 + 7%
    expect(draft.items).toHaveLength(1)
    expect(draft.items[0].amount).toBe(1000)
  })

  it('edits an existing Draft in place, recomputing totals', async () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(null, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer)
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = saveMockDocumentDraft(
      draft.id,
      company.id,
      'user-1',
      {
        ...formInput,
        customerId: customer.id,
        items: [
          { description: 'ค่าบริการที่ปรึกษา (แก้ไข)', quantity: 2, unit: 'งาน', unitPrice: 500, discountType: 'AMOUNT', discountValue: 0 },
        ],
      },
      customer,
    )

    expect(updated.id).toBe(draft.id)
    expect(updated.subtotal).toBe(1000)
    expect(updated.items[0].description).toBe('ค่าบริการที่ปรึกษา (แก้ไข)')
    expect(listMockDocumentsForCompany(company.id)).toHaveLength(1)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(draft.updatedAt).getTime())
  })

  it('refuses to edit a document that is no longer a Draft', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(null, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer)
    approveMockDraftDocument(draft.id, 'user-1')

    expect(() =>
      saveMockDocumentDraft(draft.id, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer),
    ).toThrow('แก้ไขได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  })

  it('throws when editing an unknown document id', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    expect(() =>
      saveMockDocumentDraft('missing-id', company.id, 'user-1', { ...formInput, customerId: customer.id }, customer),
    ).toThrow('ไม่พบเอกสาร')
  })

  it('allows saving a Draft with zero items', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(
      null,
      company.id,
      'user-1',
      { ...formInput, customerId: customer.id, items: [] },
      customer,
    )
    expect(draft.items).toHaveLength(0)
    expect(draft.grandTotal).toBe(0)
  })

  it('refuses to edit a PAID document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    // documentType overridden to RECEIPT — only receipts can be marked paid.
    const draft = saveMockDocumentDraft(
      null,
      company.id,
      'user-1',
      { ...formInput, documentType: 'RECEIPT', customerId: customer.id },
      customer,
    )
    approveMockDraftDocument(draft.id, 'user-1')
    markMockDocumentPaid(draft.id, 'user-1')

    expect(() =>
      saveMockDocumentDraft(draft.id, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer),
    ).toThrow('แก้ไขได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  })

  it('refuses to edit a CANCELLED document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(null, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer)
    approveMockDraftDocument(draft.id, 'user-1')
    cancelMockDocument(draft.id, 'user-1')

    expect(() =>
      saveMockDocumentDraft(draft.id, company.id, 'user-1', { ...formInput, customerId: customer.id }, customer),
    ).toThrow('แก้ไขได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  })
})

describe('markMockDocumentPaid', () => {
  it('flips an APPROVED RECEIPT to PAID without touching its document_number', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'RECEIPT', 'user-1').id,
      'user-1',
    )

    const paid = markMockDocumentPaid(approved.id, 'user-1')

    expect(paid.status).toBe('PAID')
    expect(paid.documentNumber).toBe(approved.documentNumber)
  })

  it('refuses to mark a DRAFT as paid', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'RECEIPT', 'user-1')

    expect(() => markMockDocumentPaid(draft.id, 'user-1')).toThrow('บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  })

  it('refuses to mark an already-PAID document as paid again', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'RECEIPT', 'user-1').id,
      'user-1',
    )
    markMockDocumentPaid(approved.id, 'user-1')

    expect(() => markMockDocumentPaid(approved.id, 'user-1')).toThrow('บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  })

  it('throws for an unknown document id', () => {
    expect(() => markMockDocumentPaid('missing-id', 'user-1')).toThrow('ไม่พบเอกสาร')
  })

  it.each(['RFQ', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'CREDIT_NOTE', 'CREDIT_NOTE_TAX'] as const)(
    'refuses to mark an APPROVED %s as paid — only receipts represent money collected',
    (documentType) => {
      const company = setupCompany()
      saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
      const approved = approveMockDraftDocument(
        createMockDraftDocument(company.id, documentType, 'user-1').id,
        'user-1',
      )

      expect(() => markMockDocumentPaid(approved.id, 'user-1')).toThrow('บันทึกชำระเงินได้เฉพาะใบเสร็จรับเงินเท่านั้น')
    },
  )

  it('cascades PAID through the full document chain: QUOTATION stays APPROVED, INVOICE and sibling TAX_INVOICE become PAID', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const quotation = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')
    const invoice = approveMockDraftDocument(createMockDocumentConversion(quotation.id, 'INVOICE', 'user-1').id, 'user-1')
    const receipt = approveMockDraftDocument(createMockDocumentConversion(invoice.id, 'RECEIPT', 'user-1').id, 'user-1')
    const taxInvoice = approveMockDraftDocument(
      createMockDocumentConversion(invoice.id, 'TAX_INVOICE', 'user-1').id,
      'user-1',
    )

    markMockDocumentPaid(receipt.id, 'user-1')

    expect(getMockDocumentById(receipt.id)?.status).toBe('PAID')
    expect(getMockDocumentById(invoice.id)?.status).toBe('PAID')
    expect(getMockDocumentById(taxInvoice.id)?.status).toBe('PAID')
    // QUOTATION never carries money owed, so it's excluded from the cascade.
    expect(getMockDocumentById(quotation.id)?.status).toBe('APPROVED')
  })

  it('never cascades onto a CANCELLED sibling — it stays terminal', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const invoice = approveMockDraftDocument(createMockDraftDocument(company.id, 'INVOICE', 'user-1').id, 'user-1')
    const receipt = approveMockDraftDocument(createMockDocumentConversion(invoice.id, 'RECEIPT', 'user-1').id, 'user-1')
    const taxInvoice = approveMockDraftDocument(
      createMockDocumentConversion(invoice.id, 'TAX_INVOICE', 'user-1').id,
      'user-1',
    )
    cancelMockDocument(taxInvoice.id, 'user-1')

    markMockDocumentPaid(receipt.id, 'user-1')

    expect(getMockDocumentById(invoice.id)?.status).toBe('PAID')
    expect(getMockDocumentById(taxInvoice.id)?.status).toBe('CANCELLED')
  })

  it('records a cascaded MARK_DOCUMENT_PAID audit entry on the related document, tagged with cascadedFrom', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const invoice = approveMockDraftDocument(createMockDraftDocument(company.id, 'INVOICE', 'user-1').id, 'user-1')
    const receipt = approveMockDraftDocument(createMockDocumentConversion(invoice.id, 'RECEIPT', 'user-1').id, 'user-1')

    markMockDocumentPaid(receipt.id, 'user-1')

    const invoiceLogs = listMockAuditLogsForEntity('document', invoice.id)
    const cascadedLog = invoiceLogs.find((l) => l.action === 'MARK_DOCUMENT_PAID')
    expect(cascadedLog?.metadata).toMatchObject({ cascadedFrom: receipt.documentNumber })
  })
})

describe('cancelMockDocument', () => {
  it('flips an APPROVED document to CANCELLED without touching its document_number', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id,
      'user-1',
    )

    const cancelled = cancelMockDocument(approved.id, 'user-1')

    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.documentNumber).toBe(approved.documentNumber)
  })

  it('refuses to cancel a DRAFT (drafts are discarded via delete instead)', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(() => cancelMockDocument(draft.id, 'user-1')).toThrow('ยกเลิกได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  })

  it('refuses to cancel a PAID document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'RECEIPT', 'user-1').id,
      'user-1',
    )
    markMockDocumentPaid(approved.id, 'user-1')

    expect(() => cancelMockDocument(approved.id, 'user-1')).toThrow('ยกเลิกได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  })

  it('throws for an unknown document id', () => {
    expect(() => cancelMockDocument('missing-id', 'user-1')).toThrow('ไม่พบเอกสาร')
  })
})

describe('listMockDocumentsForCompany', () => {
  it('shows saved Drafts, Approved, Paid, and Cancelled documents, scoped to their own company', () => {
    const company = setupCompany()
    const otherCompany = createMockCompany('user-2', {
      ...companyInput,
      companyCode: 'OTHER',
      taxId: '0105561000002',
    })
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')

    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'INVOICE', 'user-1').id, 'user-1')
    const paid = markMockDocumentPaid(
      approveMockDraftDocument(createMockDraftDocument(company.id, 'RECEIPT', 'user-1').id, 'user-1').id,
      'user-1',
    )
    const cancelled = cancelMockDocument(
      approveMockDraftDocument(createMockDraftDocument(company.id, 'CREDIT_NOTE', 'user-1').id, 'user-1').id,
      'user-1',
    )
    createMockDraftDocument(otherCompany.id, 'QUOTATION', 'user-2')

    const list = listMockDocumentsForCompany(company.id)

    expect(list).toHaveLength(4)
    expect(list.map((d) => d.id).sort()).toEqual([draft.id, approved.id, paid.id, cancelled.id].sort())
    expect(list.map((d) => d.status).sort()).toEqual(['APPROVED', 'CANCELLED', 'DRAFT', 'PAID'])
  })
})

describe('createMockDocumentRevision', () => {
  const customerInput = {
    customerCode: 'ORCHID',
    name: 'บริษัท ออร์คิด เดโม จำกัด',
    taxId: '',
    branch: '',
    address: '',
    phone: '',
    email: '',
    contactName: '',
    note: '',
  }

  function approveWithNumbering(company: ReturnType<typeof setupCompany>, draftId: string) {
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    return approveMockDraftDocument(draftId, 'user-1')
  }

  it('creates a revision Draft from an APPROVED original with no official revision number', () => {
    const company = setupCompany()
    const approved = approveWithNumbering(company, createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id)

    const revision = createMockDocumentRevision(approved.id, 'user-1')

    expect(revision.status).toBe('DRAFT')
    expect(revision.documentNumber).toBeNull()
    expect(revision.revisionNo).toBeNull()
    expect(revision.parentDocumentId).toBe(approved.id)
  })

  it('refuses to create a revision from a Draft document', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(() => createMockDocumentRevision(draft.id, 'user-1')).toThrow(
      'สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น',
    )
  })

  it('refuses to create a revision from a Cancelled document', () => {
    const company = setupCompany()
    const approved = approveWithNumbering(company, createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id)
    cancelMockDocument(approved.id, 'user-1')

    expect(() => createMockDocumentRevision(approved.id, 'user-1')).toThrow(
      'สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น',
    )
  })

  it('refuses to create a revision from a revision — nested revisions are not supported', () => {
    const company = setupCompany()
    const approved = approveWithNumbering(company, createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id)
    const revision1 = approveMockDraftDocument(createMockDocumentRevision(approved.id, 'user-1').id, 'user-1')

    expect(() => createMockDocumentRevision(revision1.id, 'user-1')).toThrow(
      'ไม่สามารถสร้าง Revision จากเอกสารที่เป็น Revision ได้',
    )
  })

  it('copies customer, line items, VAT mode, note, payment term, document type, and totals from the source', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(
      null,
      company.id,
      'user-1',
      {
        documentType: 'INVOICE',
        customerId: customer.id,
        vatMode: 'VAT_INCLUDED',
        issueDate: '2026-07-01',
        dueDate: '2026-07-15',
        note: 'ชำระภายใน 15 วัน',
        documentDiscountType: 'PERCENT',
        documentDiscountValue: 5,
        items: [
          { description: 'ค่าที่ปรึกษา', quantity: 2, unit: 'ครั้ง', unitPrice: 500, discountType: 'AMOUNT', discountValue: 0 },
        ],
      },
      customer,
    )
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(draft.id, 'user-1')

    const revision = createMockDocumentRevision(approved.id, 'user-1')

    expect(revision.customerId).toBe(approved.customerId)
    expect(revision.customerCode).toBe(approved.customerCode)
    expect(revision.documentType).toBe('INVOICE')
    expect(revision.vatMode).toBe('VAT_INCLUDED')
    expect(revision.note).toBe('ชำระภายใน 15 วัน')
    expect(revision.dueDate).toBe('2026-07-15') // payment term
    expect(revision.documentDiscountType).toBe('PERCENT')
    expect(revision.documentDiscountValue).toBe(5)
    expect(revision.subtotal).toBe(approved.subtotal)
    expect(revision.discountTotal).toBe(approved.discountTotal)
    expect(revision.vatAmount).toBe(approved.vatAmount)
    expect(revision.grandTotal).toBe(approved.grandTotal)
    expect(revision.items).toHaveLength(1)
    expect(revision.items[0].description).toBe('ค่าที่ปรึกษา')
    expect(revision.items[0].quantity).toBe(2)
    expect(revision.items[0].unitPrice).toBe(500)
    expect(revision.items[0].amount).toBe(approved.items[0].amount)
    // Copied items get their own fresh ids, not the source's.
    expect(revision.items[0].id).not.toBe(approved.items[0].id)
    // issueDate is deliberately NOT copied — a revision is freshly issued "now".
    expect(revision.issueDate).not.toBe('2026-07-01')
  })

  it('throws for an unknown source document id', () => {
    expect(() => createMockDocumentRevision('missing-id', 'user-1')).toThrow('ไม่พบเอกสาร')
  })
})

describe('approveMockDraftDocument — revision numbering', () => {
  it('approving a revision generates PARENT_NUMBER-R1', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')
    const revisionDraft = createMockDocumentRevision(approved.id, 'user-1')

    const approvedRevision = approveMockDraftDocument(revisionDraft.id, 'user-1')

    expect(approvedRevision.status).toBe('APPROVED')
    expect(approvedRevision.revisionNo).toBe(1)
    expect(approvedRevision.documentNumber).toBe(`${approved.documentNumber}-R1`)
  })

  it('a second revision of the same original generates PARENT_NUMBER-R2', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const revision1 = approveMockDraftDocument(createMockDocumentRevision(approved.id, 'user-1').id, 'user-1')
    // The second revision is created from the ORIGINAL again, not from revision1.
    const revision2 = approveMockDraftDocument(createMockDocumentRevision(approved.id, 'user-1').id, 'user-1')

    expect(revision1.documentNumber).toBe(`${approved.documentNumber}-R1`)
    expect(revision2.documentNumber).toBe(`${approved.documentNumber}-R2`)
  })

  it('an approved revision is immutable — cannot be edited or re-approved', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', {
      customerCode: 'ORCHID',
      name: 'บริษัท ออร์คิด เดโม จำกัด',
      taxId: '',
      branch: '',
      address: '',
      phone: '',
      email: '',
      contactName: '',
      note: '',
    })
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')
    const revision = approveMockDraftDocument(createMockDocumentRevision(approved.id, 'user-1').id, 'user-1')

    expect(() => approveMockDraftDocument(revision.id, 'user-1')).toThrow(
      'เอกสารนี้ไม่ได้อยู่ในสถานะฉบับร่าง ไม่สามารถอนุมัติซ้ำได้',
    )
    expect(() =>
      saveMockDocumentDraft(
        revision.id,
        company.id,
        'user-1',
        {
          documentType: revision.documentType,
          customerId: customer.id,
          vatMode: revision.vatMode,
          issueDate: revision.issueDate,
          dueDate: '',
          note: '',
          documentDiscountType: 'AMOUNT',
          documentDiscountValue: 0,
          items: [],
        },
        customer,
      ),
    ).toThrow('แก้ไขได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  })
})

describe('listMockDocumentRevisions', () => {
  it('returns all revisions of a given original document, in creation order', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const revision1 = createMockDocumentRevision(approved.id, 'user-1')
    const revision2 = createMockDocumentRevision(approved.id, 'user-1')

    const revisions = listMockDocumentRevisions(approved.id)

    expect(revisions).toHaveLength(2)
    expect(revisions.map((r) => r.id)).toEqual([revision1.id, revision2.id])
  })

  it('returns an empty array for a document with no revisions', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(listMockDocumentRevisions(draft.id)).toEqual([])
  })
})

describe('createMockDocumentConversion', () => {
  const customerInput = {
    customerCode: 'ORCHID',
    name: 'บริษัท ออร์คิด เดโม จำกัด',
    taxId: '',
    branch: '',
    address: '',
    phone: '',
    email: '',
    contactName: '',
    note: '',
  }

  it('lets an approved QUOTATION convert to an INVOICE draft', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const converted = createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')

    expect(converted.documentType).toBe('INVOICE')
    expect(converted.status).toBe('DRAFT')
  })

  it('gives the converted draft no official document number', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const converted = createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')

    expect(converted.documentNumber).toBeNull()
  })

  it('sets source_document_id to the original document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const converted = createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')

    expect(converted.sourceDocumentId).toBe(approved.id)
    expect(converted.parentDocumentId).toBeNull() // conversion, not a revision
  })

  it('copies customer, line items, VAT mode, note, payment term, and totals from the source', () => {
    const company = setupCompany()
    const customer = createMockCustomer(company.id, 'user-1', customerInput)
    const draft = saveMockDocumentDraft(
      null,
      company.id,
      'user-1',
      {
        documentType: 'QUOTATION',
        customerId: customer.id,
        vatMode: 'VAT_INCLUDED',
        issueDate: '2026-07-01',
        dueDate: '2026-07-20',
        note: 'ยืนราคา 30 วัน',
        documentDiscountType: 'PERCENT',
        documentDiscountValue: 5,
        items: [
          { description: 'ค่าที่ปรึกษา', quantity: 2, unit: 'ครั้ง', unitPrice: 500, discountType: 'AMOUNT', discountValue: 0 },
        ],
      },
      customer,
    )
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(draft.id, 'user-1')

    const converted = createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')

    expect(converted.customerId).toBe(approved.customerId)
    expect(converted.customerCode).toBe(approved.customerCode)
    expect(converted.vatMode).toBe('VAT_INCLUDED')
    expect(converted.note).toBe('ยืนราคา 30 วัน')
    expect(converted.dueDate).toBe('2026-07-20') // payment term
    expect(converted.documentDiscountType).toBe('PERCENT')
    expect(converted.documentDiscountValue).toBe(5)
    expect(converted.subtotal).toBe(approved.subtotal)
    expect(converted.discountTotal).toBe(approved.discountTotal)
    expect(converted.vatAmount).toBe(approved.vatAmount)
    expect(converted.grandTotal).toBe(approved.grandTotal)
    expect(converted.items).toHaveLength(1)
    expect(converted.items[0].description).toBe('ค่าที่ปรึกษา')
    expect(converted.items[0].amount).toBe(approved.items[0].amount)
  })

  it('blocks an invalid conversion (not in documentConversionMap)', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    expect(() => createMockDocumentConversion(approved.id, 'RECEIPT', 'user-1')).toThrow(
      'ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้',
    )
  })

  it('refuses to convert a Draft document', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(() => createMockDocumentConversion(draft.id, 'INVOICE', 'user-1')).toThrow(
      'แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น',
    )
  })

  it('refuses to convert a Cancelled document', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')
    cancelMockDocument(approved.id, 'user-1')

    expect(() => createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')).toThrow(
      'แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น',
    )
  })

  it('throws for an unknown source document id', () => {
    expect(() => createMockDocumentConversion('missing-id', 'INVOICE', 'user-1')).toThrow('ไม่พบเอกสาร')
  })

  it('allows converting a PAID invoice to RECEIPT and TAX_INVOICE — PAID must not block downstream document creation', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const invoice = approveMockDraftDocument(createMockDraftDocument(company.id, 'INVOICE', 'user-1').id, 'user-1')
    const receipt = approveMockDraftDocument(createMockDocumentConversion(invoice.id, 'RECEIPT', 'user-1').id, 'user-1')
    markMockDocumentPaid(receipt.id, 'user-1')
    expect(getMockDocumentById(invoice.id)?.status).toBe('PAID')

    const taxInvoice = createMockDocumentConversion(invoice.id, 'TAX_INVOICE', 'user-1')

    expect(taxInvoice.documentType).toBe('TAX_INVOICE')
    expect(taxInvoice.status).toBe('DRAFT')
    expect(taxInvoice.sourceDocumentId).toBe(invoice.id)
  })

  it('records a CONVERT_DOCUMENT entry in the new document\'s timeline', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')

    const converted = createMockDocumentConversion(approved.id, 'INVOICE', 'user-1')

    const logs = listMockAuditLogsForEntity('document', converted.id)
    expect(logs.map((l) => l.action)).toContain('CONVERT_DOCUMENT')
  })
})

describe('listMockDocumentConversions', () => {
  it('returns every document converted from a given source, in creation order', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'INVOICE', 'user-1').id, 'user-1')

    const receipt = createMockDocumentConversion(approved.id, 'RECEIPT', 'user-1')
    const taxInvoice = createMockDocumentConversion(approved.id, 'TAX_INVOICE', 'user-1')

    const conversions = listMockDocumentConversions(approved.id)

    expect(conversions).toHaveLength(2)
    expect(conversions.map((d) => d.id)).toEqual([receipt.id, taxInvoice.id])
  })

  it('returns an empty array for a document with no conversions', () => {
    const company = setupCompany()
    const draft = createMockDraftDocument(company.id, 'QUOTATION', 'user-1')

    expect(listMockDocumentConversions(draft.id)).toEqual([])
  })
})

describe('document activity timeline (Phase 6A)', () => {
  it('records approve/paid/cancel/revision events for the correct document ids', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const draft = createMockDraftDocument(company.id, 'RECEIPT', 'user-1')
    const approved = approveMockDraftDocument(draft.id, 'user-1')

    expect(listMockAuditLogsForEntity('document', approved.id).map((l) => l.action)).toEqual([
      'DOCUMENT_NUMBER_GENERATED',
      'APPROVE_DOCUMENT',
    ])

    markMockDocumentPaid(approved.id, 'user-1')
    expect(listMockAuditLogsForEntity('document', approved.id).map((l) => l.action)).toContain(
      'MARK_DOCUMENT_PAID',
    )
  })

  it('records CANCEL_DOCUMENT and CREATE_DOCUMENT_REVISION on their respective document ids', () => {
    const company = setupCompany()
    saveMockNumberingSetting(company.id, null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    const approved = approveMockDraftDocument(createMockDraftDocument(company.id, 'QUOTATION', 'user-1').id, 'user-1')
    const revision = createMockDocumentRevision(approved.id, 'user-1')

    expect(listMockAuditLogsForEntity('document', revision.id).map((l) => l.action)).toContain(
      'CREATE_DOCUMENT_REVISION',
    )

    const approvedForCancel = approveMockDraftDocument(
      createMockDraftDocument(company.id, 'INVOICE', 'user-1').id,
      'user-1',
    )
    cancelMockDocument(approvedForCancel.id, 'user-1')
    expect(listMockAuditLogsForEntity('document', approvedForCancel.id).map((l) => l.action)).toContain(
      'CANCEL_DOCUMENT',
    )
  })
})
