export type AuthErrorCode =
  | 'EMAIL_NOT_CONFIRMED'
  | 'INVALID_CREDENTIALS'
  | 'USER_EXISTS'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'WEAK_PASSWORD'
  | 'SESSION_MISSING'
  | 'UNKNOWN'

export interface MappedAuthError {
  message: string
  code: AuthErrorCode
}

/**
 * Supabase (and our mock auth) throw plain Error objects with English
 * messages. This maps the common cases to Thai copy the UI can show
 * directly, and tags a code so callers can branch (e.g. show a "resend
 * confirmation email" action).
 */
export function mapAuthErrorMessage(error: unknown): MappedAuthError {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()

  if (lower.includes('email not confirmed')) {
    return {
      message: 'อีเมลนี้ยังไม่ได้ยืนยัน กรุณาตรวจสอบกล่องจดหมายของคุณ',
      code: 'EMAIL_NOT_CONFIRMED',
    }
  }
  if (lower.includes('invalid login credentials') || lower.includes('ไม่ถูกต้อง')) {
    return { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', code: 'INVALID_CREDENTIALS' }
  }
  if (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('user already') ||
    lower.includes('ถูกใช้งานแล้ว')
  ) {
    return { message: 'อีเมลนี้ถูกใช้งานแล้ว', code: 'USER_EXISTS' }
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('security purposes')
  ) {
    return {
      message: 'คำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง',
      code: 'RATE_LIMITED',
    }
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return {
      message: 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ตของคุณ',
      code: 'NETWORK',
    }
  }
  if (lower.includes('session') || lower.includes('jwt') || lower.includes('expired')) {
    return {
      message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่อีกครั้ง',
      code: 'SESSION_MISSING',
    }
  }
  if (lower.includes('password')) {
    return {
      message: 'รหัสผ่านไม่ตรงตามเงื่อนไขที่กำหนด กรุณาใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร',
      code: 'WEAK_PASSWORD',
    }
  }

  return { message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', code: 'UNKNOWN' }
}
