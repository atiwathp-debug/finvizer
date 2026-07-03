import type { ResetPolicy } from '@/types/numbering'

/** Constant bucket for NEVER — the counter never resets, so every document type has exactly one sequence row per company. */
export const NEVER_RESET_SEQUENCE_KEY = 'ALL'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Derives the numbering_sequences bucket key for a given reset policy and
 * point in time — mirrors the `case reset_policy when ...` in
 * supabase/migrations/20260707120000_document_numbering_generation.sql's
 * approve_document() RPC exactly. A new bucket naturally starts a fresh
 * running_number at 1 with no extra reset logic needed anywhere.
 */
export function computeSequenceKey(resetPolicy: ResetPolicy, at: Date): string {
  const yyyy = String(at.getFullYear())
  const mm = pad2(at.getMonth() + 1)
  const dd = pad2(at.getDate())

  switch (resetPolicy) {
    case 'DAILY':
      return `${yyyy}${mm}${dd}`
    case 'MONTHLY':
      return `${yyyy}${mm}`
    case 'YEARLY':
      return yyyy
    case 'NEVER':
      return NEVER_RESET_SEQUENCE_KEY
  }
}
