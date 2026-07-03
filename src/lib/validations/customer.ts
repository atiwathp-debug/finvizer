import { z } from 'zod'

const customerCodeSchema = z
  .string()
  .min(1, 'กรุณากรอกรหัสลูกค้า')
  .max(20, 'รหัสลูกค้าต้องไม่เกิน 20 ตัวอักษร')
  .regex(/^[A-Za-z0-9-]+$/, 'รหัสลูกค้าใช้ได้เฉพาะ A-Z, 0-9 และ "-"')
  .transform((value) => value.toUpperCase())

const nameSchema = z.string().min(1, 'กรุณากรอกชื่อลูกค้า').max(200, 'ชื่อยาวเกินไป')

// tax_id/branch/address/phone/contact_name/note are all optional — not
// every customer (e.g. a quick add for a new lead) has complete data yet.
const optionalTextSchema = (max: number) => z.string().max(max, 'ข้อความยาวเกินไป')

const taxIdSchema = z
  .string()
  .max(20)
  .refine((value) => value === '' || /^\d{13}$/.test(value), {
    message: 'เลขประจำตัวผู้เสียภาษี/บัตรประชาชนต้องเป็นตัวเลข 13 หลัก',
  })

const emailSchema = z
  .string()
  .max(200)
  .refine((value) => value === '' || z.string().email().safeParse(value).success, {
    message: 'รูปแบบอีเมลไม่ถูกต้อง',
  })

export const customerFormSchema = z.object({
  customerCode: customerCodeSchema,
  name: nameSchema,
  taxId: taxIdSchema,
  branch: optionalTextSchema(100),
  address: optionalTextSchema(500),
  phone: optionalTextSchema(30),
  email: emailSchema,
  contactName: optionalTextSchema(100),
  note: optionalTextSchema(1000),
})
export type CustomerFormValues = z.infer<typeof customerFormSchema>
