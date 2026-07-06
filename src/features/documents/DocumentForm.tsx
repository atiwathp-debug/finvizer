import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { documentFormSchema, type DocumentFormValues } from '@/lib/validations/document'
import { calculateDocumentTotals, validateInstallmentSum } from '@/lib/calculations/documentTotals'
import { LineItemEditor } from '@/features/documents/LineItemEditor'
import { InstallmentEditor } from '@/features/documents/InstallmentEditor'
import { FinancialSummary } from '@/features/documents/FinancialSummary'
import { DocumentPreview } from '@/features/documents/DocumentPreview'
import { FormField } from '@/components/shared/FormField'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { resolveDocumentTypeLabel } from '@/lib/templates/documentTemplateText'
import { documentTypeLabels, vatModeLabels } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'
import type { SignatureSlot } from '@/types/signature'

const DEFAULT_VALUES: DocumentFormValues = {
  documentType: 'QUOTATION',
  customerId: '',
  vatMode: 'VAT_EXCLUDED',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  note: '',
  documentDiscountType: 'AMOUNT',
  documentDiscountValue: 0,
  items: [],
  installmentPlan: 'FULL',
  installments: [],
  installmentNumber: null,
}

interface DocumentFormProps {
  company: Company
  customers: Customer[]
  signatureSlots?: SignatureSlot[]
  initialValues?: DocumentFormValues
  isSaving?: boolean
  onSave: (values: DocumentFormValues) => void
  onCancel: () => void
}

export function DocumentForm({
  company,
  customers,
  signatureSlots,
  initialValues,
  isSaving = false,
  onSave,
  onCancel,
}: DocumentFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: initialValues ?? DEFAULT_VALUES,
  })

  const watched = useWatch({ control })
  const vatMode = watched.vatMode ?? 'VAT_EXCLUDED'
  const documentType = watched.documentType ?? 'QUOTATION'
  const watchedItems = watched.items ?? []

  const totals = calculateDocumentTotals({
    items: watchedItems.map((item) => ({
      quantity: Number(item?.quantity) || 0,
      unitPrice: Number(item?.unitPrice) || 0,
      discountType: item?.discountType ?? 'AMOUNT',
      discountValue: Number(item?.discountValue) || 0,
    })),
    documentDiscountType: watched.documentDiscountType ?? 'AMOUNT',
    documentDiscountValue: Number(watched.documentDiscountValue) || 0,
    vatMode,
  })

  const selectedCustomer = customers.find((c) => c.id === watched.customerId)

  // Reuses the existing `note` field rather than adding a new column --
  // this toggle just controls whether the typed note is kept or cleared
  // on save, so an existing document's note-shown/hidden state round-trips
  // correctly (toFormValues seeds initialValues.note, so a document saved
  // with a note starts with the checkbox checked; one without starts
  // unchecked -- matching today's behavior of "no note = nothing renders").
  const [showNote, setShowNote] = useState(() => Boolean(initialValues?.note))

  const handleValidatedSave = handleSubmit((values) => {
    if (values.installmentPlan === 'INSTALLMENT') {
      const sumCheck = validateInstallmentSum(values.installments, totals.grandTotal)
      if (sumCheck.exceedsGrandTotal) {
        setError('installments', {
          type: 'manual',
          message: 'ยอดรวมตามงวดต้องไม่เกินยอดรวมทั้งสิ้นของเอกสาร',
        })
        return
      }
    }
    onSave({ ...values, note: showNote ? values.note : '' })
  })

  return (
    <form onSubmit={handleValidatedSave} noValidate className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {customers.length === 0 && (
            <PhaseNotice>ยังไม่มีลูกค้าในบริษัทนี้ กรุณาเพิ่มลูกค้าที่เมนู "ลูกค้า" ก่อนสร้างเอกสาร</PhaseNotice>
          )}

          <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="ประเภทเอกสาร" htmlFor="document-type" error={errors.documentType?.message}>
                <Select id="document-type" {...register('documentType')}>
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="ลูกค้า" htmlFor="document-customer" error={errors.customerId?.message}>
                <Select id="document-customer" {...register('customerId')}>
                  <option value="">เลือกลูกค้า</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customerCode})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="รูปแบบภาษีมูลค่าเพิ่ม" htmlFor="document-vat-mode" error={errors.vatMode?.message}>
                <Select id="document-vat-mode" {...register('vatMode')}>
                  {Object.entries(vatModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="วันที่ออกเอกสาร" htmlFor="document-issue-date" error={errors.issueDate?.message}>
                <Input id="document-issue-date" type="date" {...register('issueDate')} />
              </FormField>

              <FormField label="วันครบกำหนด (ถ้ามี)" htmlFor="document-due-date" error={errors.dueDate?.message}>
                <Input id="document-due-date" type="date" {...register('dueDate')} />
              </FormField>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={showNote}
                    onChange={(event) => setShowNote(event.target.checked)}
                    className="h-4 w-4 rounded border-line"
                  />
                  แสดงหมายเหตุในเอกสาร
                </label>
                {showNote && (
                  <div className="mt-2">
                    <FormField label="หมายเหตุ" htmlFor="document-note" error={errors.note?.message}>
                      <Textarea
                        id="document-note"
                        rows={4}
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี) — กด Enter เพื่อขึ้นบรรทัดใหม่"
                        {...register('note')}
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <LineItemEditor control={control} register={register} errors={errors} />
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <InstallmentEditor control={control} register={register} errors={errors} grandTotal={totals.grandTotal} />
          </div>

          <FinancialSummary register={register} errors={errors} totals={totals} vatMode={vatMode} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
              ยกเลิก
            </Button>
            <Button type="submit" isLoading={isSaving}>
              บันทึกฉบับร่าง
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4">
            <DocumentPreview
              companyName={company.nameTh}
              companyAddress={company.address}
              companyTaxId={company.taxId}
              companyPhone={company.phone}
              logoUrl={company.logoUrl}
              logoSize={company.logoSize}
              logoPosition={company.logoPosition}
              template={company.documentTemplate}
              documentTypeLabel={resolveDocumentTypeLabel(documentType, company.templateTextOverrides)}
              customerName={selectedCustomer?.name}
              customerAddress={selectedCustomer?.address}
              issueDate={watched.issueDate ?? ''}
              dueDate={watched.dueDate}
              items={watchedItems.map((item, index) => ({
                description: item?.description ?? '',
                quantity: Number(item?.quantity) || 0,
                unit: item?.unit ?? '',
                unitPrice: Number(item?.unitPrice) || 0,
                amount: totals.itemAmounts[index] ?? 0,
              }))}
              totals={totals}
              vatMode={vatMode}
              note={showNote ? watched.note : ''}
              signatureSlots={signatureSlots}
              installmentPlan={watched.installmentPlan}
              installments={watched.installments}
              templateTextOverrides={company.templateTextOverrides}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
