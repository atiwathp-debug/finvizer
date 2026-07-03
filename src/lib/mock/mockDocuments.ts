import { computeSequenceKey } from '@/lib/numbering/sequenceKey'
import { incrementMockSequence } from '@/lib/mock/mockNumberingSequences'
import { listMockNumberingSettings } from '@/lib/mock/mockNumbering'
import { getMockCompanyById } from '@/lib/mock/mockCompany'
import { renderPatternPreview } from '@/lib/validations/numberingPattern'
import { calculateDocumentTotals } from '@/lib/calculations/documentTotals'
import { appendMockAuditLog } from '@/lib/mock/mockAuditLogs'
import {
  canConvertDocumentType,
  documentTypeShortCode,
  type DocumentRecord,
  type DocumentType,
  type LineItem,
} from '@/types/document'
import type { DocumentFormValues } from '@/lib/validations/document'
import type { Customer } from '@/types/customer'

const DOCUMENTS_KEY = 'finvizer_mock_documents'
const MAX_ATTEMPTS = 3

function readDocuments(): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY)
    return raw ? (JSON.parse(raw) as DocumentRecord[]) : []
  } catch {
    return []
  }
}

function writeDocuments(documents: DocumentRecord[]) {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents))
}

export function listMockDocumentsForCompany(companyId: string): DocumentRecord[] {
  return readDocuments().filter((d) => d.companyId === companyId)
}

export function getMockDocumentById(documentId: string): DocumentRecord | null {
  return readDocuments().find((d) => d.id === documentId) ?? null
}

/** Minimal Draft creation (Phase 2C) — still used directly where only the numbering-relevant fields matter. Phase 4A's full editing flow is saveMockDocumentDraft() below. */
export function createMockDraftDocument(
  companyId: string,
  documentType: DocumentType,
  createdBy: string,
  customerCode?: string | null,
): DocumentRecord {
  const now = new Date().toISOString()
  const document: DocumentRecord = {
    id: crypto.randomUUID(),
    companyId,
    documentType,
    status: 'DRAFT',
    customerId: null,
    customerCode: customerCode ?? null,
    documentNumber: null,
    vatMode: 'VAT_EXCLUDED',
    issueDate: now.slice(0, 10),
    dueDate: null,
    note: null,
    documentDiscountType: 'AMOUNT',
    documentDiscountValue: 0,
    subtotal: 0,
    discountTotal: 0,
    vatAmount: 0,
    grandTotal: 0,
    items: [],
    createdBy,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    parentDocumentId: null,
    revisionNo: null,
    sourceDocumentId: null,
  }
  writeDocuments([...readDocuments(), document])
  return document
}

/** Only Drafts are deletable — they never had a running number, so this can never create a gap. */
export function deleteMockDraftDocument(documentId: string): void {
  const documents = readDocuments()
  const target = documents.find((d) => d.id === documentId)
  if (!target) throw new Error('ไม่พบเอกสาร')
  if (target.status !== 'DRAFT') {
    throw new Error('ลบได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  }
  writeDocuments(documents.filter((d) => d.id !== documentId))
}

/**
 * Creates a new Draft (documentId = null) or saves changes to an existing
 * one (documentId given) — the full Phase 4A editing flow, computing
 * totals via the shared calculation engine before persisting. Throws if
 * the target document exists but is no longer a Draft, mirroring the real
 * `documents_update_draft_only` RLS policy (Phase 4A migration).
 */
export function saveMockDocumentDraft(
  documentId: string | null,
  companyId: string,
  createdBy: string,
  input: DocumentFormValues,
  customer: Customer,
): DocumentRecord {
  const totals = calculateDocumentTotals({
    items: input.items,
    documentDiscountType: input.documentDiscountType,
    documentDiscountValue: input.documentDiscountValue,
    vatMode: input.vatMode,
  })

  const items: LineItem[] = input.items.map((item, index) => ({
    id: crypto.randomUUID(),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit || null,
    unitPrice: item.unitPrice,
    discountType: item.discountType,
    discountValue: item.discountValue,
    amount: totals.itemAmounts[index],
    sortOrder: index,
  }))

  const now = new Date().toISOString()

  if (documentId === null) {
    const document: DocumentRecord = {
      id: crypto.randomUUID(),
      companyId,
      documentType: input.documentType,
      status: 'DRAFT',
      customerId: customer.id,
      customerCode: customer.customerCode,
      documentNumber: null,
      vatMode: input.vatMode,
      issueDate: input.issueDate,
      dueDate: input.dueDate || null,
      note: input.note || null,
      documentDiscountType: input.documentDiscountType,
      documentDiscountValue: input.documentDiscountValue,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      items,
      createdBy,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
      parentDocumentId: null,
      revisionNo: null,
      sourceDocumentId: null,
    }
    writeDocuments([...readDocuments(), document])
    return document
  }

  const documents = readDocuments()
  const index = documents.findIndex((d) => d.id === documentId)
  if (index === -1) {
    throw new Error('ไม่พบเอกสาร')
  }
  if (documents[index].status !== 'DRAFT') {
    throw new Error('แก้ไขได้เฉพาะเอกสารที่ยังเป็นฉบับร่างเท่านั้น')
  }

  const updated: DocumentRecord = {
    ...documents[index],
    documentType: input.documentType,
    customerId: customer.id,
    customerCode: customer.customerCode,
    vatMode: input.vatMode,
    issueDate: input.issueDate,
    dueDate: input.dueDate || null,
    note: input.note || null,
    documentDiscountType: input.documentDiscountType,
    documentDiscountValue: input.documentDiscountValue,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    vatAmount: totals.vatAmount,
    grandTotal: totals.grandTotal,
    items,
    updatedAt: now,
  }
  documents[index] = updated
  writeDocuments(documents)
  return updated
}

/**
 * Mock Mode's equivalent of the real `approve_document` RPC — same
 * validation order, same sequence-key/running-number/collision-retry
 * logic, just running client-side against localStorage instead of a
 * Postgres transaction. Safe here because Mock Mode is single-threaded
 * JS: this whole function body executes synchronously, so there's no
 * window for a second "concurrent" approval to interleave.
 */
export function approveMockDraftDocument(documentId: string, approvedBy: string): DocumentRecord {
  const documents = readDocuments()
  const index = documents.findIndex((d) => d.id === documentId)
  if (index === -1) {
    throw new Error('ไม่พบเอกสาร')
  }
  const document = documents[index]
  if (document.status !== 'DRAFT') {
    throw new Error('เอกสารนี้ไม่ได้อยู่ในสถานะฉบับร่าง ไม่สามารถอนุมัติซ้ำได้')
  }

  if (document.parentDocumentId !== null) {
    return approveMockRevisionDraft(documents, index, approvedBy)
  }

  const company = getMockCompanyById(document.companyId)
  if (!company) {
    throw new Error('ไม่พบบริษัท')
  }

  // Prefer a per-document-type override, fall back to the company-wide default.
  const settingsForCompany = listMockNumberingSettings(document.companyId)
  const settings =
    settingsForCompany.find((s) => s.documentType === document.documentType) ??
    settingsForCompany.find((s) => s.documentType === null)
  if (!settings) {
    throw new Error('บริษัทยังไม่ได้ตั้งค่ารูปแบบเลขที่เอกสาร กรุณาตั้งค่าก่อนอนุมัติเอกสาร')
  }

  if (settings.pattern.includes('{CUSTOMER_CODE}') && !document.customerCode?.trim()) {
    throw new Error('รูปแบบเลขที่เอกสารนี้ต้องมีรหัสลูกค้า กรุณาระบุรหัสลูกค้าก่อนอนุมัติ')
  }

  const now = new Date()
  const sequenceKey = computeSequenceKey(settings.resetPolicy, now)
  const docTypeCode = documentTypeShortCode[document.documentType]

  let documentNumber = ''
  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    attempt++
    const runningNumber = incrementMockSequence(document.companyId, document.documentType, sequenceKey)
    documentNumber = renderPatternPreview(settings.pattern, {
      companyCode: company.companyCode,
      branchCode: company.branchCode,
      docTypeCode,
      customerCode: document.customerCode ?? undefined,
      date: now,
      runningNumber,
    })

    const collides = documents.some(
      (d) => d.companyId === document.companyId && d.documentNumber === documentNumber,
    )
    if (!collides) break
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error('ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง (เลขที่เอกสารซ้ำ)')
    }
  }

  const nowIso = now.toISOString()
  const updated: DocumentRecord = {
    ...document,
    status: 'APPROVED',
    documentNumber,
    approvedBy,
    approvedAt: nowIso,
    updatedAt: nowIso,
  }
  documents[index] = updated
  writeDocuments(documents)

  appendMockAuditLog({
    companyId: updated.companyId,
    actorId: approvedBy,
    action: 'DOCUMENT_NUMBER_GENERATED',
    entityType: 'document',
    entityId: updated.id,
    metadata: { documentNumber },
  })
  appendMockAuditLog({
    companyId: updated.companyId,
    actorId: approvedBy,
    action: 'APPROVE_DOCUMENT',
    entityType: 'document',
    entityId: updated.id,
    metadata: { documentNumber, documentType: updated.documentType },
  })

  return updated
}

/**
 * Revision branch of approveMockDraftDocument — mirrors the real
 * approve_document() RPC's revision path: no numbering_settings/sequence
 * involved at all, just "PARENT_NUMBER-R{n}" where n is one past the
 * highest revision_no already approved for the same parent.
 */
function approveMockRevisionDraft(
  documents: DocumentRecord[],
  index: number,
  approvedBy: string,
): DocumentRecord {
  const document = documents[index]
  const parent = documents.find((d) => d.id === document.parentDocumentId)
  if (!parent || parent.documentNumber === null) {
    throw new Error('ไม่พบเอกสารต้นฉบับ หรือเอกสารต้นฉบับยังไม่มีเลขที่เอกสาร')
  }

  const highestRevisionNo = documents
    .filter((d) => d.parentDocumentId === document.parentDocumentId && d.revisionNo !== null)
    .reduce((max, d) => Math.max(max, d.revisionNo ?? 0), 0)
  const revisionNo = highestRevisionNo + 1

  const nowIso = new Date().toISOString()
  const updated: DocumentRecord = {
    ...document,
    status: 'APPROVED',
    documentNumber: `${parent.documentNumber}-R${revisionNo}`,
    revisionNo,
    approvedBy,
    approvedAt: nowIso,
    updatedAt: nowIso,
  }
  documents[index] = updated
  writeDocuments(documents)

  appendMockAuditLog({
    companyId: updated.companyId,
    actorId: approvedBy,
    action: 'APPROVE_REVISION',
    entityType: 'document',
    entityId: updated.id,
    metadata: { documentNumber: updated.documentNumber, revisionNo, parentDocumentId: document.parentDocumentId },
  })

  return updated
}

/**
 * Mock Mode's equivalent of the real create_document_revision() RPC —
 * copies customer, line items, VAT mode, note, due_date (payment term),
 * document type, and totals from an APPROVED, non-revision source
 * document into a fresh Draft. issue_date is deliberately NOT copied — a
 * revision is freshly issued "now". Only an original may be revised
 * (parentDocumentId must be null on the source), matching the real RPC.
 */
export function createMockDocumentRevision(documentId: string, createdBy: string): DocumentRecord {
  const documents = readDocuments()
  const source = documents.find((d) => d.id === documentId)
  if (!source) {
    throw new Error('ไม่พบเอกสาร')
  }
  if (source.status !== 'APPROVED') {
    throw new Error('สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  }
  if (source.parentDocumentId !== null) {
    throw new Error('ไม่สามารถสร้าง Revision จากเอกสารที่เป็น Revision ได้')
  }

  const now = new Date().toISOString()
  const revision: DocumentRecord = {
    id: crypto.randomUUID(),
    companyId: source.companyId,
    documentType: source.documentType,
    status: 'DRAFT',
    customerId: source.customerId,
    customerCode: source.customerCode,
    documentNumber: null,
    parentDocumentId: source.id,
    revisionNo: null,
    sourceDocumentId: null,
    vatMode: source.vatMode,
    issueDate: now.slice(0, 10),
    dueDate: source.dueDate,
    note: source.note,
    documentDiscountType: source.documentDiscountType,
    documentDiscountValue: source.documentDiscountValue,
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    vatAmount: source.vatAmount,
    grandTotal: source.grandTotal,
    items: source.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    createdBy,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  writeDocuments([...documents, revision])

  appendMockAuditLog({
    companyId: revision.companyId,
    actorId: createdBy,
    action: 'CREATE_DOCUMENT_REVISION',
    entityType: 'document',
    entityId: revision.id,
    metadata: { parentDocumentId: source.id, parentDocumentNumber: source.documentNumber },
  })

  return revision
}

/** All revisions of a given original document, in approval/creation order — used for the detail page's revision timeline. */
export function listMockDocumentRevisions(originalDocumentId: string): DocumentRecord[] {
  return readDocuments()
    .filter((d) => d.parentDocumentId === originalDocumentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Mock Mode's equivalent of the real create_document_conversion() RPC —
 * copies customer, line items, VAT mode, note, due_date (payment term),
 * and totals from an APPROVED-or-PAID source into a fresh Draft of a
 * *different* document_type (unlike a revision, which keeps the same
 * type). PAID sources are allowed too — a paid INVOICE with no RECEIPT/
 * TAX_INVOICE on file yet is a real accounting gap this must let a user
 * close; PAID only blocks editing/cancelling, not downstream document
 * creation. Only allowed when documentConversionMap permits source ->
 * target, checked server-side here exactly like the real RPC checks it
 * via is_valid_document_conversion() — never trust the UI alone to have
 * enforced this.
 */
export function createMockDocumentConversion(
  documentId: string,
  targetType: DocumentType,
  createdBy: string,
): DocumentRecord {
  const documents = readDocuments()
  const source = documents.find((d) => d.id === documentId)
  if (!source) {
    throw new Error('ไม่พบเอกสาร')
  }
  if (source.status !== 'APPROVED' && source.status !== 'PAID') {
    throw new Error('แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น')
  }
  if (!canConvertDocumentType(source.documentType, targetType)) {
    throw new Error('ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้')
  }

  const now = new Date().toISOString()
  const converted: DocumentRecord = {
    id: crypto.randomUUID(),
    companyId: source.companyId,
    documentType: targetType,
    status: 'DRAFT',
    customerId: source.customerId,
    customerCode: source.customerCode,
    documentNumber: null,
    parentDocumentId: null,
    revisionNo: null,
    sourceDocumentId: source.id,
    vatMode: source.vatMode,
    issueDate: now.slice(0, 10),
    dueDate: source.dueDate,
    note: source.note,
    documentDiscountType: source.documentDiscountType,
    documentDiscountValue: source.documentDiscountValue,
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    vatAmount: source.vatAmount,
    grandTotal: source.grandTotal,
    items: source.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    createdBy,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  writeDocuments([...documents, converted])

  appendMockAuditLog({
    companyId: converted.companyId,
    actorId: createdBy,
    action: 'CONVERT_DOCUMENT',
    entityType: 'document',
    entityId: converted.id,
    metadata: { sourceDocumentId: source.id, sourceDocumentType: source.documentType, targetType },
  })

  return converted
}

/** Every document converted FROM a given source document, in creation order — used for the detail page's conversion history. */
export function listMockDocumentConversions(sourceDocumentId: string): DocumentRecord[] {
  return readDocuments()
    .filter((d) => d.sourceDocumentId === sourceDocumentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

const PAYABLE_DOCUMENT_TYPES: DocumentType[] = ['RECEIPT', 'RECEIPT_TAX_INVOICE']
const CASCADE_PAID_DOCUMENT_TYPES: DocumentType[] = ['INVOICE', 'TAX_INVOICE', 'RECEIPT', 'RECEIPT_TAX_INVOICE']

/**
 * Every document connected to `documentId` via source_document_id, walked
 * in both directions (ancestors and descendants), excluding `documentId`
 * itself. Mirrors the recursive CTE in the real mark_document_paid() RPC
 * (supabase/migrations/20260713120000_paid_cascade.sql) — same shape, just
 * over the in-memory array instead of SQL.
 */
function findConnectedDocuments(documents: DocumentRecord[], documentId: string): DocumentRecord[] {
  const byId = new Map(documents.map((d) => [d.id, d]))
  const chain = new Set<string>([documentId])
  let frontier = [documentId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      const doc = byId.get(id)
      if (doc?.sourceDocumentId && !chain.has(doc.sourceDocumentId)) {
        chain.add(doc.sourceDocumentId)
        next.push(doc.sourceDocumentId)
      }
      for (const candidate of documents) {
        if (candidate.sourceDocumentId === id && !chain.has(candidate.id)) {
          chain.add(candidate.id)
          next.push(candidate.id)
        }
      }
    }
    frontier = next
  }
  chain.delete(documentId)
  return documents.filter((d) => chain.has(d.id))
}

/**
 * Mock Mode's equivalent of the real mark_document_paid() RPC — APPROVED ->
 * PAID, restricted to RECEIPT/RECEIPT_TAX_INVOICE (the only document types
 * that represent money actually collected), and cascades PAID to every
 * other APPROVED INVOICE/TAX_INVOICE/RECEIPT/RECEIPT_TAX_INVOICE connected
 * to it through the conversion chain — see findConnectedDocuments() above.
 */
export function markMockDocumentPaid(documentId: string, actorId: string): DocumentRecord {
  const documents = readDocuments()
  const index = documents.findIndex((d) => d.id === documentId)
  if (index === -1) {
    throw new Error('ไม่พบเอกสาร')
  }
  if (documents[index].status !== 'APPROVED') {
    throw new Error('บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  }
  if (!PAYABLE_DOCUMENT_TYPES.includes(documents[index].documentType)) {
    throw new Error('บันทึกชำระเงินได้เฉพาะใบเสร็จรับเงินเท่านั้น')
  }
  const now = new Date().toISOString()
  const updated: DocumentRecord = {
    ...documents[index],
    status: 'PAID',
    updatedAt: now,
  }
  documents[index] = updated

  const connected = findConnectedDocuments(documents, documentId)
  const cascaded: DocumentRecord[] = []
  for (const related of connected) {
    if (related.status !== 'APPROVED' || !CASCADE_PAID_DOCUMENT_TYPES.includes(related.documentType)) continue
    const relatedIndex = documents.findIndex((d) => d.id === related.id)
    const paidRelated: DocumentRecord = { ...related, status: 'PAID', updatedAt: now }
    documents[relatedIndex] = paidRelated
    cascaded.push(paidRelated)
  }

  writeDocuments(documents)

  appendMockAuditLog({
    companyId: updated.companyId,
    actorId,
    action: 'MARK_DOCUMENT_PAID',
    entityType: 'document',
    entityId: updated.id,
    metadata: { documentNumber: updated.documentNumber },
  })
  for (const paidRelated of cascaded) {
    appendMockAuditLog({
      companyId: paidRelated.companyId,
      actorId,
      action: 'MARK_DOCUMENT_PAID',
      entityType: 'document',
      entityId: paidRelated.id,
      metadata: { documentNumber: paidRelated.documentNumber, cascadedFrom: updated.documentNumber },
    })
  }

  return updated
}

/** Mock Mode's equivalent of the real cancel_document() RPC — APPROVED -> CANCELLED only. */
export function cancelMockDocument(documentId: string, actorId: string): DocumentRecord {
  const documents = readDocuments()
  const index = documents.findIndex((d) => d.id === documentId)
  if (index === -1) {
    throw new Error('ไม่พบเอกสาร')
  }
  if (documents[index].status !== 'APPROVED') {
    throw new Error('ยกเลิกได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น')
  }
  const updated: DocumentRecord = {
    ...documents[index],
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  }
  documents[index] = updated
  writeDocuments(documents)

  appendMockAuditLog({
    companyId: updated.companyId,
    actorId,
    action: 'CANCEL_DOCUMENT',
    entityType: 'document',
    entityId: updated.id,
    metadata: { documentNumber: updated.documentNumber },
  })

  return updated
}
