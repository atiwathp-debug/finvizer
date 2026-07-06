const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
/** Index = place value within a <=6-digit chunk: 0=หน่วย, 1=สิบ, 2=ร้อย, 3=พัน, 4=หมื่น, 5=แสน. */
const THAI_PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/**
 * Reads a non-negative integer digit-string as Thai number words, e.g.
 * "1070" -> "หนึ่งพันเจ็ดสิบ". Chunks anything over 6 digits and recurses
 * with a "ล้าน" separator, so arbitrarily large amounts read correctly
 * (matches the standard Thai BAHTTEXT algorithm).
 */
function digitsToThaiText(digits: string): string {
  let working = digits
  let len = working.length
  let text = ''
  if (len > 7) {
    text += digitsToThaiText(working.slice(0, len - 6)) + 'ล้าน'
    working = working.slice(len - 6)
    len = working.length
  }
  for (let i = 0; i < len; i++) {
    const digit = Number(working[i])
    const place = len - i - 1
    if (digit === 0) continue
    if (place === 1 && digit === 2) {
      text += 'ยี่'
    } else if (place === 1 && digit === 1) {
      // "สิบ" alone -- never "หนึ่งสิบ"
    } else if (place === 0 && digit === 1 && len > 1) {
      text += 'เอ็ด'
    } else {
      text += THAI_DIGITS[digit]
    }
    if (place > 0) text += THAI_PLACES[place]
  }
  return text
}

/**
 * Thai amount-in-words for a grand total, e.g. 1070.50 ->
 * "หนึ่งพันเจ็ดสิบบาทห้าสิบสตางค์" (no parentheses -- callers wrap the
 * result themselves, since not every placement wants them).
 */
export function thaiBahtText(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const [integerPart, decimalPart] = safeAmount.toFixed(2).split('.')
  const satang = Number(decimalPart)

  const bahtDigits = integerPart === '0' ? 'ศูนย์' : digitsToThaiText(integerPart)
  const satangText = satang === 0 ? 'ถ้วน' : `${digitsToThaiText(String(satang))}สตางค์`
  return `${bahtDigits}บาท${satangText}`
}
