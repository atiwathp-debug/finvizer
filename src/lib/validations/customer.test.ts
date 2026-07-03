import { describe, expect, it } from 'vitest'
import { customerFormSchema } from './customer'

const validInput = {
  customerCode: 'orchid',
  name: 'บริษัท ออร์คิด เดโม จำกัด',
  taxId: '0105562000012',
  branch: 'สำนักงานใหญ่',
  address: '12 ถนนพระราม 4 กรุงเทพมหานคร',
  phone: '02-234-5678',
  email: 'account@orchid-demo.example',
  contactName: 'คุณวิภา สวยงาม',
  note: 'ลูกค้าประจำ',
}

describe('customerFormSchema', () => {
  it('accepts a fully filled-in customer and uppercases the code', () => {
    const result = customerFormSchema.parse(validInput)
    expect(result.customerCode).toBe('ORCHID')
  })

  it('accepts a customer with only the required fields', () => {
    const result = customerFormSchema.safeParse({
      customerCode: 'demo',
      name: 'บริษัท เดโม จำกัด',
      taxId: '',
      branch: '',
      address: '',
      phone: '',
      email: '',
      contactName: '',
      note: '',
    })
    expect(result.success).toBe(true)
  })

  it('requires customerCode', () => {
    const result = customerFormSchema.safeParse({ ...validInput, customerCode: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a customerCode with disallowed characters', () => {
    const result = customerFormSchema.safeParse({ ...validInput, customerCode: 'ORC HID!' })
    expect(result.success).toBe(false)
  })

  it('requires name', () => {
    const result = customerFormSchema.safeParse({ ...validInput, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a taxId that is not exactly 13 digits, but allows empty', () => {
    expect(customerFormSchema.safeParse({ ...validInput, taxId: '123' }).success).toBe(false)
    expect(customerFormSchema.safeParse({ ...validInput, taxId: '' }).success).toBe(true)
  })

  it('rejects a malformed email, but allows empty', () => {
    expect(customerFormSchema.safeParse({ ...validInput, email: 'not-an-email' }).success).toBe(false)
    expect(customerFormSchema.safeParse({ ...validInput, email: '' }).success).toBe(true)
  })
})
