import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerFormSchema, type CustomerFormValues } from '@/lib/validations/customer'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Customer } from '@/types/customer'

interface CustomerFormProps {
  customer?: Customer | null
  isSubmitting?: boolean
  onSubmit: (values: CustomerFormValues) => void
  onCancel: () => void
}

function toFormValues(customer?: Customer | null): CustomerFormValues {
  return {
    customerCode: customer?.customerCode ?? '',
    name: customer?.name ?? '',
    taxId: customer?.taxId ?? '',
    branch: customer?.branch ?? '',
    address: customer?.address ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    contactName: customer?.contactName ?? '',
    note: customer?.note ?? '',
  }
}

export function CustomerForm({ customer, isSubmitting = false, onSubmit, onCancel }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: toFormValues(customer),
  })

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="รหัสลูกค้า" htmlFor="customer-code" error={errors.customerCode?.message}>
          <Input id="customer-code" placeholder="ORCHID" {...register('customerCode')} />
        </FormField>

        <FormField label="ชื่อลูกค้า" htmlFor="customer-name" error={errors.name?.message}>
          <Input id="customer-name" placeholder="บริษัท ตัวอย่าง จำกัด" {...register('name')} />
        </FormField>

        <FormField
          label="เลขประจำตัวผู้เสียภาษี / บัตรประชาชน"
          htmlFor="customer-tax-id"
          error={errors.taxId?.message}
        >
          <Input id="customer-tax-id" placeholder="0105561000001" {...register('taxId')} />
        </FormField>

        <FormField label="สาขา" htmlFor="customer-branch" error={errors.branch?.message}>
          <Input id="customer-branch" placeholder="สำนักงานใหญ่" {...register('branch')} />
        </FormField>

        <FormField label="เบอร์โทร" htmlFor="customer-phone" error={errors.phone?.message}>
          <Input id="customer-phone" placeholder="02-123-4567" {...register('phone')} />
        </FormField>

        <FormField label="อีเมล" htmlFor="customer-email" error={errors.email?.message}>
          <Input id="customer-email" type="email" placeholder="contact@company.com" {...register('email')} />
        </FormField>

        <FormField label="ผู้ติดต่อ" htmlFor="customer-contact" error={errors.contactName?.message}>
          <Input id="customer-contact" placeholder="สมชาย ใจดี" {...register('contactName')} />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="ที่อยู่" htmlFor="customer-address" error={errors.address?.message}>
            <Input id="customer-address" placeholder="99/9 ถนนสุขุมวิท กรุงเทพมหานคร" {...register('address')} />
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField label="หมายเหตุ" htmlFor="customer-note" error={errors.note?.message}>
            <Input id="customer-note" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" {...register('note')} />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          ยกเลิก
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {customer ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มลูกค้า'}
        </Button>
      </div>
    </form>
  )
}
