import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { calculateInstallmentAmount, validateInstallmentSum } from '@/lib/calculations/documentTotals'
import { formatTHB } from '@/lib/utils/currency'
import { installmentAmountTypeLabels } from '@/types/documentInstallment'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { DocumentFormValues } from '@/lib/validations/document'

interface InstallmentEditorProps {
  control: Control<DocumentFormValues>
  register: UseFormRegister<DocumentFormValues>
  errors: FieldErrors<DocumentFormValues>
  grandTotal: number
  disabled?: boolean
}

const EMPTY_INSTALLMENT: DocumentFormValues['installments'][number] = {
  installmentNo: 1,
  amountType: 'PERCENT',
  amountValue: 0,
  dueDate: '',
  note: '',
}

/**
 * Full payment vs installment plan toggle, shown after the line-items card
 * and before FinancialSummary. Rows are only ever persisted when the plan
 * is INSTALLMENT (see saveDraftDocument/saveMockDocumentDraft) — the
 * structural checks (percent range, at least one row) live in
 * documentFormSchema's superRefine; the sum-vs-grandTotal check needs the
 * live grandTotal, which a static Zod schema doesn't have, so it's shown
 * here as an inline warning instead (also enforced procedurally in
 * DocumentForm.tsx's submit handler).
 */
export function InstallmentEditor({ control, register, errors, grandTotal, disabled = false }: InstallmentEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'installments' })
  const installmentPlan = useWatch({ control, name: 'installmentPlan' })
  const watchedInstallments = useWatch({ control, name: 'installments' })

  const isInstallment = installmentPlan === 'INSTALLMENT'
  const sumCheck = validateInstallmentSum(watchedInstallments ?? [], grandTotal)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">เงื่อนไขการชำระเงิน</p>
        <Select
          className="w-48"
          disabled={disabled}
          {...register('installmentPlan')}
        >
          <option value="FULL">ชำระเต็มจำนวน</option>
          <option value="INSTALLMENT">แบ่งชำระเป็นงวด</option>
        </Select>
      </div>

      {isInstallment && (
        <div className="space-y-3">
          {!disabled && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => append({ ...EMPTY_INSTALLMENT, installmentNo: fields.length + 1 })}
              >
                <Plus className="size-4" aria-hidden="true" />
                เพิ่มงวด
              </Button>
            </div>
          )}

          {fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
              ยังไม่มีงวดการชำระเงิน — เพิ่มงวดได้ที่นี่
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const installment = watchedInstallments?.[index]
                const computedAmount = installment
                  ? calculateInstallmentAmount(
                      installment.amountType,
                      Number(installment.amountValue) || 0,
                      grandTotal,
                    )
                  : 0
                const installmentErrors = errors.installments?.[index]

                return (
                  <div key={field.id} className="rounded-xl border border-line p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-2">
                        <FormField label="งวดที่" htmlFor={`installment-${index}-no`}>
                          <Input
                            id={`installment-${index}-no`}
                            type="number"
                            min="1"
                            disabled={disabled}
                            {...register(`installments.${index}.installmentNo`, { valueAsNumber: true })}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-3">
                        <FormField label="ประเภทจำนวนเงิน" htmlFor={`installment-${index}-amountType`}>
                          <Select id={`installment-${index}-amountType`} disabled={disabled} {...register(`installments.${index}.amountType`)}>
                            {Object.entries(installmentAmountTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>

                      <div className="sm:col-span-3">
                        <FormField
                          label="จำนวนเงิน"
                          htmlFor={`installment-${index}-amountValue`}
                          error={installmentErrors?.amountValue?.message}
                        >
                          <Input
                            id={`installment-${index}-amountValue`}
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={disabled}
                            {...register(`installments.${index}.amountValue`, { valueAsNumber: true })}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-4">
                        <FormField label="วันครบกำหนด" htmlFor={`installment-${index}-dueDate`}>
                          <Input
                            id={`installment-${index}-dueDate`}
                            type="date"
                            disabled={disabled}
                            {...register(`installments.${index}.dueDate`)}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-8">
                        <FormField label="หมายเหตุ/รายละเอียด" htmlFor={`installment-${index}-note`}>
                          <Input
                            id={`installment-${index}-note`}
                            placeholder="เช่น มัดจำเมื่อเซ็นสัญญา"
                            disabled={disabled}
                            {...register(`installments.${index}.note`)}
                          />
                        </FormField>
                      </div>

                      <div className="flex items-end justify-between gap-2 sm:col-span-4">
                        <div>
                          <p className="text-xs text-ink-muted">จำนวนเงิน</p>
                          <p className="font-medium text-ink">{formatTHB(computedAmount)}</p>
                        </div>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            aria-label="ลบงวดนี้"
                            className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">รวมยอดตามงวด</span>
            <span className={sumCheck.exceedsGrandTotal ? 'font-medium text-red-600' : 'text-ink'}>
              {formatTHB(sumCheck.totalComputed)}
            </span>
          </div>
          {sumCheck.exceedsGrandTotal && (
            <p className="text-xs text-red-600">ยอดรวมตามงวดต้องไม่เกินยอดรวมทั้งสิ้นของเอกสาร ({formatTHB(grandTotal)})</p>
          )}
          {typeof errors.installments?.message === 'string' && (
            <p className="text-xs text-red-600">{errors.installments.message}</p>
          )}
        </div>
      )}
    </div>
  )
}
