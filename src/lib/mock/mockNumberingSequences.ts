import type { DocumentType } from '@/types/document'

const SEQUENCES_KEY = 'finvizer_mock_numbering_sequences'

interface MockSequence {
  companyId: string
  documentType: DocumentType
  sequenceKey: string
  runningNumber: number
}

function readSequences(): MockSequence[] {
  try {
    const raw = localStorage.getItem(SEQUENCES_KEY)
    return raw ? (JSON.parse(raw) as MockSequence[]) : []
  } catch {
    return []
  }
}

function writeSequences(sequences: MockSequence[]) {
  localStorage.setItem(SEQUENCES_KEY, JSON.stringify(sequences))
}

/**
 * Atomically increments (creating if absent) the running counter for
 * (companyId, documentType, sequenceKey) and returns the new value —
 * mirrors the real `insert ... on conflict do update` in
 * supabase/migrations/20260707120000_document_numbering_generation.sql.
 * Safe under Mock Mode's single-threaded JS execution: this whole
 * read-modify-write happens synchronously within one call, so there's no
 * window for a concurrent caller to interleave.
 */
export function incrementMockSequence(
  companyId: string,
  documentType: DocumentType,
  sequenceKey: string,
): number {
  const sequences = readSequences()
  const index = sequences.findIndex(
    (s) => s.companyId === companyId && s.documentType === documentType && s.sequenceKey === sequenceKey,
  )

  if (index === -1) {
    sequences.push({ companyId, documentType, sequenceKey, runningNumber: 1 })
    writeSequences(sequences)
    return 1
  }

  const nextRunningNumber = sequences[index].runningNumber + 1
  sequences[index] = { ...sequences[index], runningNumber: nextRunningNumber }
  writeSequences(sequences)
  return nextRunningNumber
}
