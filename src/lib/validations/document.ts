import { z } from 'zod'

const discountTypeSchema = z.enum(['AMOUNT', 'PERCENT'], { message: 'กรุณาเลือกประเภทส่วนลด' })

// Plain object (no .refine()) so that z.array(lineItemBaseSchema) inside
// documentFormSchema stays a ZodArray<ZodObject> instead of a
// ZodArray<ZodEffects<ZodObject>> — nesting a refined schema inside
// another schema confuses @hookform/resolvers' generic type inference
// against zodResolver (a known zod4 + hookform-resolvers pain point).
// The percent-discount check is enforced identically either way, just via
// documentFormSchema's own superRefine below instead of a nested .refine().
//
// Numeric fields use z.number() (not z.coerce.number()) — the
// corresponding <input type="number"> registrations pass
// `valueAsNumber: true` (see LineItemEditor.tsx/FinancialSummary.tsx) so
// react-hook-form itself converts the DOM string to a number before this
// schema ever sees it. Coercing inside the schema instead would make its
// *input* type differ from DocumentFormValues (its *output* type), which
// breaks zodResolver's generic inference against a `useForm<DocumentFormValues>`
// annotation — another zod4 + hookform-resolvers pain point.
const lineItemBaseSchema = z.object({
  description: z.string().min(1, 'กรุณากรอกรายการ').max(500, 'รายการยาวเกินไป'),
  quantity: z.number({ message: 'กรุณากรอกจำนวน' }).positive('จำนวนต้องมากกว่า 0'),
  unit: z.string().max(50, 'หน่วยยาวเกินไป'),
  unitPrice: z.number({ message: 'กรุณากรอกราคา' }).min(0, 'ราคาต้องไม่ติดลบ'),
  discountType: discountTypeSchema,
  discountValue: z.number({ message: 'กรุณากรอกส่วนลด' }).min(0, 'ส่วนลดต้องไม่ติดลบ'),
})

/** Standalone, fully-validated line item schema — used directly wherever a single item needs validating (e.g. tests), independent of a document. */
export const lineItemSchema = lineItemBaseSchema.refine(
  (item) => item.discountType !== 'PERCENT' || item.discountValue <= 100,
  { message: 'เปอร์เซ็นต์ส่วนลดต้องไม่เกิน 100', path: ['discountValue'] },
)
export type LineItemFormValues = z.infer<typeof lineItemBaseSchema>

const documentFormBaseSchema = z.object({
  documentType: z.enum(
    [
      'RFQ',
      'QUOTATION',
      'INVOICE',
      'TAX_INVOICE',
      'RECEIPT',
      'RECEIPT_TAX_INVOICE',
      'CREDIT_NOTE',
      'CREDIT_NOTE_TAX',
    ],
    { message: 'กรุณาเลือกประเภทเอกสาร' },
  ),
  customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
  vatMode: z.enum(['NON_VAT', 'VAT_EXCLUDED', 'VAT_INCLUDED'], { message: 'กรุณาเลือกรูปแบบภาษีมูลค่าเพิ่ม' }),
  issueDate: z.string().min(1, 'กรุณาเลือกวันที่ออกเอกสาร'),
  dueDate: z.string(),
  note: z.string().max(1000, 'หมายเหตุยาวเกินไป'),
  documentDiscountType: discountTypeSchema,
  documentDiscountValue: z.number({ message: 'กรุณากรอกส่วนลด' }).min(0, 'ส่วนลดต้องไม่ติดลบ'),
  // A Draft is allowed to have zero items — it's explicitly a work in
  // progress; Phase 4B's Approve step is the natural place to require
  // at least one line item, not draft-saving.
  items: z.array(lineItemBaseSchema),
})

export const documentFormSchema = documentFormBaseSchema.superRefine((values, ctx) => {
  if (values.documentDiscountType === 'PERCENT' && values.documentDiscountValue > 100) {
    ctx.addIssue({
      code: 'custom',
      message: 'เปอร์เซ็นต์ส่วนลดต้องไม่เกิน 100',
      path: ['documentDiscountValue'],
    })
  }

  values.items.forEach((item, index) => {
    if (item.discountType === 'PERCENT' && item.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'เปอร์เซ็นต์ส่วนลดต้องไม่เกิน 100',
        path: ['items', index, 'discountValue'],
      })
    }
  })
})
export type DocumentFormValues = z.infer<typeof documentFormBaseSchema>
