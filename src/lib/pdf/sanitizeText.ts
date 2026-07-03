/**
 * Defensive cleanup for any user-entered string before it becomes PDF text
 * content. react-pdf's <Text> already renders content as plain text (not
 * HTML/markup), so there's no injection surface the way there would be
 * with dangerouslySetInnerHTML — but control characters (null bytes, form
 * feeds, etc.) can still corrupt a PDF's underlying content stream or
 * confuse PDF viewers, so they're stripped here rather than trusted as-is.
 * Also guards against pathologically long input (e.g. a pasted essay into
 * a note field) blowing up page layout.
 */
const MAX_LENGTH = 2000

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

export function sanitizeText(value: string | null | undefined): string {
  if (!value) return ''
  const cleaned = value.replace(CONTROL_CHARS, '').trim()
  return cleaned.length > MAX_LENGTH ? `${cleaned.slice(0, MAX_LENGTH)}…` : cleaned
}
