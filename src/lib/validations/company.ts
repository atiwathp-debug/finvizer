import { z } from 'zod'

const nameThSchema = z.string().min(1, 'กรุณากรอกชื่อบริษัทภาษาไทย').max(200, 'ชื่อยาวเกินไป')
const nameEnSchema = z.string().max(200, 'ชื่อยาวเกินไป')
const taxIdSchema = z.string().regex(/^\d{13}$/, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')
const addressSchema = z.string().min(1, 'กรุณากรอกที่อยู่')
const phoneSchema = z.string().min(1, 'กรุณากรอกเบอร์โทร')
const emailSchema = z.string().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง')
const contactNameSchema = z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อ')

export const companyOnboardingSchema = z.object({
  nameTh: nameThSchema,
  nameEn: nameEnSchema,
  companyCode: z
    .string()
    .min(2, 'รหัสบริษัทต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(10, 'รหัสบริษัทต้องไม่เกิน 10 ตัวอักษร')
    .regex(/^[A-Za-z0-9]+$/, 'รหัสบริษัทต้องเป็นตัวอักษร A-Z หรือตัวเลขเท่านั้น')
    .transform((value) => value.toUpperCase()),
  taxId: taxIdSchema,
  address: addressSchema,
  phone: phoneSchema,
  email: emailSchema,
  contactName: contactNameSchema,
})
export type CompanyOnboardingFormValues = z.infer<typeof companyOnboardingSchema>

// Same fields minus companyCode: it's locked after creation so historical
// document numbers that embed {COMPANY_CODE} never silently change meaning.
export const companySettingsSchema = z.object({
  nameTh: nameThSchema,
  nameEn: nameEnSchema,
  taxId: taxIdSchema,
  address: addressSchema,
  phone: phoneSchema,
  email: emailSchema,
  contactName: contactNameSchema,
})
export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>
