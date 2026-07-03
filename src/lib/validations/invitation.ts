import { z } from 'zod'

// Kept as literal values (not derived from assignableMemberRoles) so zod can
// infer the precise union type — must stay in sync with that array.
export const inviteMemberSchema = z.object({
  email: z.string().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'EDITOR', 'VIEWER'], {
    message: 'กรุณาเลือกสิทธิ์การใช้งาน',
  }),
})
export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>
