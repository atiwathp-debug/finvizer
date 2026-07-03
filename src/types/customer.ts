export interface Customer {
  id: string
  companyId: string
  customerCode: string
  name: string
  taxId: string | null
  branch: string | null
  address: string | null
  phone: string | null
  email: string | null
  contactName: string | null
  note: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedBy: string | null
}
