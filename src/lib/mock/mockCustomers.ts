import type { CustomerFormValues } from '@/lib/validations/customer'
import type { Customer } from '@/types/customer'

const CUSTOMERS_KEY = 'finvizer_mock_customers'

function readCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY)
    return raw ? (JSON.parse(raw) as Customer[]) : []
  } catch {
    return []
  }
}

function writeCustomers(customers: Customer[]) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers))
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** All rows for the company, active and soft-deleted alike — callers filter deletedAt as needed (mirrors the real RLS + explicit-filter pattern). */
export function listMockCustomers(companyId: string): Customer[] {
  return readCustomers().filter((c) => c.companyId === companyId)
}

export function getMockCustomerById(customerId: string): Customer | null {
  return readCustomers().find((c) => c.id === customerId) ?? null
}

function assertCodeAvailable(companyId: string, customerCode: string, excludeId?: string) {
  const collision = readCustomers().some(
    (c) =>
      c.companyId === companyId &&
      c.customerCode === customerCode &&
      c.deletedAt === null &&
      c.id !== excludeId,
  )
  if (collision) {
    throw new Error('รหัสลูกค้านี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น')
  }
}

export function createMockCustomer(
  companyId: string,
  createdBy: string,
  input: CustomerFormValues,
): Customer {
  assertCodeAvailable(companyId, input.customerCode)

  const now = new Date().toISOString()
  const customer: Customer = {
    id: crypto.randomUUID(),
    companyId,
    customerCode: input.customerCode,
    name: input.name,
    taxId: nullIfEmpty(input.taxId),
    branch: nullIfEmpty(input.branch),
    address: nullIfEmpty(input.address),
    phone: nullIfEmpty(input.phone),
    email: nullIfEmpty(input.email),
    contactName: nullIfEmpty(input.contactName),
    note: nullIfEmpty(input.note),
    createdBy,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  }
  writeCustomers([...readCustomers(), customer])
  return customer
}

export function updateMockCustomer(customerId: string, input: CustomerFormValues): Customer {
  const customers = readCustomers()
  const index = customers.findIndex((c) => c.id === customerId)
  if (index === -1) {
    throw new Error('ไม่พบลูกค้า')
  }
  assertCodeAvailable(customers[index].companyId, input.customerCode, customerId)

  const updated: Customer = {
    ...customers[index],
    customerCode: input.customerCode,
    name: input.name,
    taxId: nullIfEmpty(input.taxId),
    branch: nullIfEmpty(input.branch),
    address: nullIfEmpty(input.address),
    phone: nullIfEmpty(input.phone),
    email: nullIfEmpty(input.email),
    contactName: nullIfEmpty(input.contactName),
    note: nullIfEmpty(input.note),
    updatedAt: new Date().toISOString(),
  }
  customers[index] = updated
  writeCustomers(customers)
  return updated
}

export function softDeleteMockCustomer(customerId: string, deletedBy: string): Customer {
  const customers = readCustomers()
  const index = customers.findIndex((c) => c.id === customerId)
  if (index === -1) {
    throw new Error('ไม่พบลูกค้า')
  }
  if (customers[index].deletedAt !== null) {
    throw new Error('ลูกค้ารายนี้ถูกลบไปแล้ว')
  }

  const now = new Date().toISOString()
  const updated: Customer = { ...customers[index], deletedAt: now, deletedBy, updatedAt: now }
  customers[index] = updated
  writeCustomers(customers)
  return updated
}
