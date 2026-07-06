/**
 * Configurable company logo layout for document headers (Pass 2.1) — the
 * one place "where does the logo render, and how big" is decided, shared
 * by the on-screen preview (DocumentPreview.tsx, also what gets
 * printed/exported to PDF) and the template-picker mockups
 * (DocumentTemplatePreview.tsx), so both stay in sync automatically.
 */
export type LogoPosition =
  | 'left_of_company_name'
  | 'header_left'
  | 'header_center'
  | 'header_right'
  | 'centered_logo_above_company'
  | 'hidden'

export const LOGO_POSITION_OPTIONS: LogoPosition[] = [
  'left_of_company_name',
  'header_left',
  'header_center',
  'header_right',
  'centered_logo_above_company',
  'hidden',
]

export const logoPositionLabels: Record<LogoPosition, string> = {
  left_of_company_name: 'ซ้ายชื่อบริษัท',
  header_left: 'ซ้ายของหัวเอกสาร',
  header_center: 'กึ่งกลางหัวเอกสาร',
  header_right: 'ขวาของหัวเอกสาร',
  centered_logo_above_company: 'โลโก้กลาง + ข้อมูลบริษัทกลาง',
  hidden: 'ซ่อนโลโก้',
}

export const logoPositionDescriptions: Record<LogoPosition, string> = {
  left_of_company_name: 'ตำแหน่งเริ่มต้น — โลโก้อยู่ติดกับชื่อบริษัท (เหมือนปัจจุบัน)',
  header_left: 'โลโก้อยู่ซ้ายสุดของหัวเอกสาร',
  header_center: 'โลโก้อยู่กึ่งกลางหัวเอกสาร',
  header_right: 'โลโก้อยู่ขวาสุดของหัวเอกสาร',
  centered_logo_above_company:
    'โลโก้อยู่กึ่งกลางด้านบนสุด ชื่อบริษัท ที่อยู่ เลขประจำตัวผู้เสียภาษี และเบอร์โทรเรียงกึ่งกลางด้านล่างโลโก้ ส่วนประเภท/เลขที่เอกสารจะแสดงแยกด้านล่าง ไม่ทับกัน',
  hidden: 'ไม่แสดงโลโก้ในเอกสาร แม้จะอัปโหลดไว้แล้ว',
}

export const LOGO_SIZE_MIN = 24
export const LOGO_SIZE_MAX = 200
export const LOGO_SIZE_DEFAULT = 48

/** Clamps to the safe [LOGO_SIZE_MIN, LOGO_SIZE_MAX] range so an oversized/invalid value can never break a document layout. */
export function clampLogoSize(size: number): number {
  if (!Number.isFinite(size)) return LOGO_SIZE_DEFAULT
  return Math.min(LOGO_SIZE_MAX, Math.max(LOGO_SIZE_MIN, Math.round(size)))
}

export type LogoHeaderSlot = 'left' | 'center' | 'right'

/**
 * True if the logo should render at the given header slot for the given
 * position setting. `left_of_company_name` and `header_left` intentionally
 * both resolve to the 'left' slot — every existing template already places
 * the logo at the header's left/start area by design, so both options
 * reproduce today's exact placement (see Company Settings page). Only
 * `header_center`/`header_right` actually move it. `hidden` and
 * `centered_logo_above_company` both resolve to no slot — the latter
 * renders its own dedicated stacked header instead (see
 * isCenteredCompanyHeader below), never through this per-slot mechanism.
 */
export function shouldRenderLogoAtSlot(position: LogoPosition, slot: LogoHeaderSlot): boolean {
  if (position === 'hidden' || position === 'centered_logo_above_company') return false
  if (slot === 'center') return position === 'header_center'
  if (slot === 'right') return position === 'header_right'
  return position === 'left_of_company_name' || position === 'header_left'
}

/**
 * True when the logo and company info (name/address/tax ID/phone) should
 * render as one centered vertical block at the top of the header, with the
 * document type/number rendered separately below it — never beside it, so
 * they can't overlap. Templates check this before falling back to the
 * normal per-slot layout.
 */
export function isCenteredCompanyHeader(position: LogoPosition): boolean {
  return position === 'centered_logo_above_company'
}
