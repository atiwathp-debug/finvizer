import { isMockMode, requireSupabase } from '@/lib/supabase/client'
import {
  createMockCustomer,
  listMockCustomers,
  softDeleteMockCustomer,
  updateMockCustomer,
} from '@/lib/mock/mockCustomers'
import { logError } from '@/lib/utils/debugLog'
import type { CustomerFormValues } from '@/lib/validations/customer'
import type { Customer } from '@/types/customer'

function mapCustomerRow(row: {
  id: string
  company_id: string
  customer_code: string
  name: string
  tax_id: string | null
  branch: string | null
  address: string | null
  phone: string | null
  email: string | null
  contact_name: string | null
  note: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}): Customer {
  return {
    id: row.id,
    companyId: row.company_id,
    customerCode: row.customer_code,
    name: row.name,
    taxId: row.tax_id,
    branch: row.branch,
    address: row.address,
    phone: row.phone,
    email: row.email,
    contactName: row.contact_name,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  }
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Active customers only (deleted_at is null) — the normal list view. */
export async function listCustomers(companyId: string): Promise<Customer[]> {
  if (isMockMode) return listMockCustomers(companyId).filter((c) => c.deletedAt === null)

  try {
    const { data, error } = await requireSupabase()
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name')
    if (error) throw error
    return (data ?? []).map(mapCustomerRow)
  } catch (error) {
    logError('customers.listCustomers', error, { companyId })
    throw error
  }
}

export async function createCustomer(
  companyId: string,
  createdBy: string,
  input: CustomerFormValues,
): Promise<Customer> {
  if (isMockMode) return createMockCustomer(companyId, createdBy, input)

  try {
    const { data, error } = await requireSupabase()
      .from('customers')
      .insert({
        company_id: companyId,
        created_by: createdBy,
        customer_code: input.customerCode,
        name: input.name,
        tax_id: nullIfEmpty(input.taxId),
        branch: nullIfEmpty(input.branch),
        address: nullIfEmpty(input.address),
        phone: nullIfEmpty(input.phone),
        email: nullIfEmpty(input.email),
        contact_name: nullIfEmpty(input.contactName),
        note: nullIfEmpty(input.note),
      })
      .select()
      .single()
    if (error) throw error
    return mapCustomerRow(data)
  } catch (error) {
    logError('customers.createCustomer', error, { companyId, input })
    throw error
  }
}

export async function updateCustomer(customerId: string, input: CustomerFormValues): Promise<Customer> {
  if (isMockMode) return updateMockCustomer(customerId, input)

  try {
    const { data, error } = await requireSupabase()
      .from('customers')
      .update({
        customer_code: input.customerCode,
        name: input.name,
        tax_id: nullIfEmpty(input.taxId),
        branch: nullIfEmpty(input.branch),
        address: nullIfEmpty(input.address),
        phone: nullIfEmpty(input.phone),
        email: nullIfEmpty(input.email),
        contact_name: nullIfEmpty(input.contactName),
        note: nullIfEmpty(input.note),
      })
      .eq('id', customerId)
      .select()
      .single()
    if (error) throw error
    return mapCustomerRow(data)
  } catch (error) {
    logError('customers.updateCustomer', error, { customerId, input })
    throw error
  }
}

/** Soft delete only — sets deleted_at/deleted_by via a plain UPDATE, never a hard DELETE (no DELETE grant exists on this table). */
export async function softDeleteCustomer(customerId: string, deletedBy: string): Promise<Customer> {
  if (isMockMode) return softDeleteMockCustomer(customerId, deletedBy)

  try {
    const { data, error } = await requireSupabase()
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', customerId)
      .select()
      .single()
    if (error) throw error
    return mapCustomerRow(data)
  } catch (error) {
    logError('customers.softDeleteCustomer', error, { customerId })
    throw error
  }
}
