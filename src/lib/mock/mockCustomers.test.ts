import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMockCustomer,
  getMockCustomerById,
  listMockCustomers,
  softDeleteMockCustomer,
  updateMockCustomer,
} from './mockCustomers'
import type { CustomerFormValues } from '@/lib/validations/customer'

beforeEach(() => {
  localStorage.clear()
})

const input: CustomerFormValues = {
  customerCode: 'ORCHID',
  name: 'บริษัท ออร์คิด เดโม จำกัด',
  taxId: '0105562000012',
  branch: 'สำนักงานใหญ่',
  address: '12 ถนนพระราม 4 กรุงเทพมหานคร',
  phone: '02-234-5678',
  email: 'account@orchid-demo.example',
  contactName: 'คุณวิภา สวยงาม',
  note: '',
}

describe('createMockCustomer', () => {
  it('creates a customer scoped to the company, not soft-deleted', () => {
    const customer = createMockCustomer('company-1', 'user-1', input)

    expect(customer.companyId).toBe('company-1')
    expect(customer.customerCode).toBe('ORCHID')
    expect(customer.deletedAt).toBeNull()
    expect(customer.deletedBy).toBeNull()
    expect(listMockCustomers('company-1')).toHaveLength(1)
  })

  it('stores optional empty fields as null, not empty strings', () => {
    const customer = createMockCustomer('company-1', 'user-1', { ...input, note: '' })
    expect(customer.note).toBeNull()
  })

  it('rejects a duplicate customer_code within the same company', () => {
    createMockCustomer('company-1', 'user-1', input)
    expect(() => createMockCustomer('company-1', 'user-1', input)).toThrow('ถูกใช้งานแล้ว')
  })

  it('allows the same customer_code in a different company', () => {
    createMockCustomer('company-1', 'user-1', input)
    expect(() => createMockCustomer('company-2', 'user-1', input)).not.toThrow()
  })
})

describe('updateMockCustomer', () => {
  it('updates fields and bumps updatedAt', async () => {
    const customer = createMockCustomer('company-1', 'user-1', input)
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = updateMockCustomer(customer.id, { ...input, name: 'ชื่อใหม่' })

    expect(updated.name).toBe('ชื่อใหม่')
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(customer.updatedAt).getTime())
  })

  it('allows keeping the same customer_code on the same row', () => {
    const customer = createMockCustomer('company-1', 'user-1', input)
    expect(() => updateMockCustomer(customer.id, input)).not.toThrow()
  })

  it('rejects changing to a customer_code already used by another active customer', () => {
    createMockCustomer('company-1', 'user-1', { ...input, customerCode: 'CPULSE' })
    const customer = createMockCustomer('company-1', 'user-1', input)

    expect(() => updateMockCustomer(customer.id, { ...input, customerCode: 'CPULSE' })).toThrow(
      'ถูกใช้งานแล้ว',
    )
  })

  it('throws for an unknown customer id', () => {
    expect(() => updateMockCustomer('missing-id', input)).toThrow('ไม่พบลูกค้า')
  })
})

describe('softDeleteMockCustomer', () => {
  it('sets deletedAt/deletedBy instead of removing the row', () => {
    const customer = createMockCustomer('company-1', 'user-1', input)

    const deleted = softDeleteMockCustomer(customer.id, 'user-1')

    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.deletedBy).toBe('user-1')
    // Still present in the raw list — soft delete, not a real removal.
    expect(listMockCustomers('company-1')).toHaveLength(1)
    expect(getMockCustomerById(customer.id)?.deletedAt).not.toBeNull()
  })

  it('frees up the customer_code for reuse once soft-deleted', () => {
    const customer = createMockCustomer('company-1', 'user-1', input)
    softDeleteMockCustomer(customer.id, 'user-1')

    expect(() => createMockCustomer('company-1', 'user-1', input)).not.toThrow()
  })

  it('refuses to delete an already-deleted customer', () => {
    const customer = createMockCustomer('company-1', 'user-1', input)
    softDeleteMockCustomer(customer.id, 'user-1')

    expect(() => softDeleteMockCustomer(customer.id, 'user-1')).toThrow('ถูกลบไปแล้ว')
  })

  it('throws for an unknown customer id', () => {
    expect(() => softDeleteMockCustomer('missing-id', 'user-1')).toThrow('ไม่พบลูกค้า')
  })
})
