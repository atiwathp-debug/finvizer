const SEPARATOR = '-'
const MAX_PREVIEW_LENGTH = 64

export const NUMBERING_PRESET_PATTERNS = [
  '{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}',
  '{COMPANY_CODE}-{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}',
  '{COMPANY_CODE}-{BRANCH_CODE}-{DOC_TYPE}-{YY}{MM}-{RUNNING:4}',
  '{DOC_TYPE}-{CUSTOMER_CODE}-{YYYY}-{RUNNING:4}',
] as const

export type NumberingToken =
  | '{COMPANY_CODE}'
  | '{BRANCH_CODE}'
  | '{DOC_TYPE}'
  | '{CUSTOMER_CODE}'
  | '{PROJECT_CODE}'
  | '{YYYY}'
  | '{YY}'
  | '{MM}'
  | '{DD}'
  | '{RUNNING:3}'
  | '{RUNNING:4}'
  | '{RUNNING:5}'

interface NumberingTokenMeta {
  token: NumberingToken
  label: string
  /** {PROJECT_CODE} isn't wired to real data anywhere yet — shown but not selectable. */
  comingSoon?: boolean
}

export const numberingTokenCatalog: NumberingTokenMeta[] = [
  { token: '{COMPANY_CODE}', label: 'รหัสบริษัท' },
  { token: '{BRANCH_CODE}', label: 'รหัสสาขา' },
  { token: '{DOC_TYPE}', label: 'ประเภทเอกสาร' },
  { token: '{CUSTOMER_CODE}', label: 'รหัสลูกค้า' },
  { token: '{PROJECT_CODE}', label: 'รหัสโครงการ', comingSoon: true },
  { token: '{YYYY}', label: 'ปี (4 หลัก)' },
  { token: '{YY}', label: 'ปี (2 หลัก)' },
  { token: '{MM}', label: 'เดือน (2 หลัก)' },
  { token: '{DD}', label: 'วัน (2 หลัก)' },
  { token: '{RUNNING:3}', label: 'เลขรัน 3 หลัก' },
  { token: '{RUNNING:4}', label: 'เลขรัน 4 หลัก' },
  { token: '{RUNNING:5}', label: 'เลขรัน 5 หลัก' },
]

const SUPPORTED_TOKENS = new Set<string>(numberingTokenCatalog.map((t) => t.token))
/** Matches any `{NAME}` or `{NAME:digit}` shaped placeholder, valid or not — used to separate "token-shaped" text from stray characters. */
const TOKEN_SHAPE_REGEX = /\{[A-Z_]+(?::\d)?\}/g
const RUNNING_TOKEN_REGEX = /^\{RUNNING:[345]\}$/

/** Joins selected tokens with the fixed "-" separator — used by the Custom Pattern Builder. */
export function buildPattern(tokens: string[]): string {
  return tokens.join(SEPARATOR)
}

export interface PatternPreviewContext {
  companyCode: string
  branchCode: string
  /** Short code for the document type being previewed, e.g. "QO" — see documentTypeShortCode. */
  docTypeCode: string
  customerCode?: string
  /** Defaults to now(); pass an explicit date in tests for deterministic output. */
  date?: Date
  /** Defaults to 1 (illustrative preview). Phase 2C's real generation passes the actual running_number. */
  runningNumber?: number
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/** Renders a pattern's {TOKEN} placeholders into a realistic example string, e.g. "QO-20260701-0001". */
export function renderPatternPreview(pattern: string, context: PatternPreviewContext): string {
  const date = context.date ?? new Date()
  const yyyy = String(date.getFullYear())
  const values: Record<string, string> = {
    COMPANY_CODE: context.companyCode,
    BRANCH_CODE: context.branchCode,
    DOC_TYPE: context.docTypeCode,
    CUSTOMER_CODE: context.customerCode ?? 'CUSTCODE',
    PROJECT_CODE: 'PROJCODE',
    YYYY: yyyy,
    YY: yyyy.slice(-2),
    MM: pad(date.getMonth() + 1, 2),
    DD: pad(date.getDate(), 2),
  }

  const runningNumber = context.runningNumber ?? 1
  return pattern.replace(/\{([A-Z_]+)(?::(\d))?\}/g, (match, name: string, digits?: string) => {
    if (name === 'RUNNING') {
      return pad(runningNumber, Number(digits ?? 4))
    }
    return values[name] ?? match
  })
}

export interface PatternValidationResult {
  valid: boolean
  /** Blocking — pattern cannot be saved while any of these are present. */
  errors: string[]
  /** Non-blocking — informational, e.g. the {CUSTOMER_CODE} data-completeness notice. */
  warnings: string[]
  preview: string
}

/**
 * Strictly validates a numbering pattern (preset or custom) per the Phase
 * 2B spec: must include {DOC_TYPE}, exactly one {RUNNING:n}, at least one
 * of {YYYY}/{YY}, only supported tokens plus A-Z/0-9/"-", and a rendered
 * preview no longer than 64 characters.
 */
export function validateNumberingPattern(
  pattern: string,
  context: PatternPreviewContext,
): PatternValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const trimmed = pattern.trim()

  if (!trimmed) {
    return { valid: false, errors: ['กรุณาเลือกอย่างน้อย 1 token'], warnings, preview: '' }
  }

  // Anything left after stripping every token-shaped placeholder and "-"
  // is disallowed — the builder only ever inserts tokens plus the fixed
  // separator, so any other character (including bare A-Z/0-9 text) means
  // the pattern didn't come from the builder.
  const strippedOfTokens = trimmed.replace(TOKEN_SHAPE_REGEX, '').replaceAll(SEPARATOR, '')
  if (strippedOfTokens.length > 0) {
    errors.push('รูปแบบมีอักขระที่ไม่รองรับ (อนุญาตเฉพาะ A-Z, 0-9, "-" และ token ที่กำหนด)')
  }

  const foundTokens = trimmed.match(TOKEN_SHAPE_REGEX) ?? []
  for (const token of foundTokens) {
    const isKnownRunning = RUNNING_TOKEN_REGEX.test(token)
    if (!SUPPORTED_TOKENS.has(token) && !isKnownRunning) {
      errors.push(`token ที่ไม่รองรับ: ${token}`)
      continue
    }
    const meta = numberingTokenCatalog.find((t) => t.token === token)
    if (meta?.comingSoon) {
      errors.push(`${token} ยังไม่เปิดให้ใช้งาน (เร็ว ๆ นี้)`)
    }
  }

  if (!trimmed.includes('{DOC_TYPE}')) {
    errors.push('ต้องมี {DOC_TYPE} ในรูปแบบเลขที่เอกสาร')
  }

  const runningTokens = foundTokens.filter((token) => RUNNING_TOKEN_REGEX.test(token))
  if (runningTokens.length === 0) {
    errors.push('ต้องมีเลขรัน {RUNNING:n} อย่างน้อย 1 ตำแหน่ง')
  } else if (runningTokens.length > 1) {
    errors.push('ใส่เลขรัน {RUNNING:n} ได้เพียงตำแหน่งเดียว')
  }

  if (!trimmed.includes('{YYYY}') && !trimmed.includes('{YY}')) {
    errors.push('ต้องมี {YYYY} หรือ {YY} อย่างน้อย 1 ตำแหน่ง')
  }

  const preview = renderPatternPreview(trimmed, context)
  if (preview.length > MAX_PREVIEW_LENGTH) {
    errors.push(`ตัวอย่างเลขที่เอกสารยาวเกินไป (${preview.length}/${MAX_PREVIEW_LENGTH} ตัวอักษร)`)
  }

  if (trimmed.includes('{CUSTOMER_CODE}')) {
    warnings.push(
      'การใช้ {CUSTOMER_CODE} ต้องกำหนดรหัสลูกค้าให้ครบทุกรายการ มิฉะนั้นจะไม่สามารถออกเลขที่เอกสารได้',
    )
  }

  return { valid: errors.length === 0, errors, warnings, preview }
}
