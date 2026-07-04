import { beforeEach, describe, expect, it } from 'vitest'
import { listMockDocumentInstallments, saveMockDocumentInstallments } from './mockDocumentInstallments'
import type { DocumentInstallment } from '@/types/documentInstallment'

beforeEach(() => {
  localStorage.clear()
})

function makeInstallment(overrides: Partial<DocumentInstallment> = {}): DocumentInstallment {
  return {
    id: crypto.randomUUID(),
    documentId: 'document-1',
    installmentNo: 1,
    amountType: 'PERCENT',
    amountValue: 50,
    computedAmount: 500,
    dueDate: null,
    note: null,
    sortOrder: 0,
    ...overrides,
  }
}

describe('listMockDocumentInstallments', () => {
  it('returns an empty list for a document with no installments', () => {
    expect(listMockDocumentInstallments('document-1')).toHaveLength(0)
  })

  it('only returns rows for the given document', () => {
    saveMockDocumentInstallments('document-1', [makeInstallment({ documentId: 'document-1' })])
    saveMockDocumentInstallments('document-2', [makeInstallment({ documentId: 'document-2', installmentNo: 1 })])

    expect(listMockDocumentInstallments('document-1')).toHaveLength(1)
    expect(listMockDocumentInstallments('document-2')).toHaveLength(1)
  })

  it('returns rows in sortOrder', () => {
    saveMockDocumentInstallments('document-1', [
      makeInstallment({ installmentNo: 2, sortOrder: 1, note: 'second' }),
      makeInstallment({ installmentNo: 1, sortOrder: 0, note: 'first' }),
    ])

    expect(listMockDocumentInstallments('document-1').map((i) => i.note)).toEqual(['first', 'second'])
  })
})

describe('saveMockDocumentInstallments', () => {
  it('replaces a document\'s rows instead of appending', () => {
    saveMockDocumentInstallments('document-1', [makeInstallment({ installmentNo: 1 })])

    saveMockDocumentInstallments('document-1', [
      makeInstallment({ installmentNo: 1, sortOrder: 0 }),
      makeInstallment({ installmentNo: 2, sortOrder: 1 }),
    ])

    expect(listMockDocumentInstallments('document-1')).toHaveLength(2)
  })

  it('clears a document\'s rows when saved with an empty array', () => {
    saveMockDocumentInstallments('document-1', [makeInstallment()])
    saveMockDocumentInstallments('document-1', [])

    expect(listMockDocumentInstallments('document-1')).toHaveLength(0)
  })

  it('does not affect another document\'s saved rows', () => {
    saveMockDocumentInstallments('document-2', [makeInstallment({ documentId: 'document-2' })])

    saveMockDocumentInstallments('document-1', [makeInstallment({ documentId: 'document-1' })])

    expect(listMockDocumentInstallments('document-2')).toHaveLength(1)
  })
})
