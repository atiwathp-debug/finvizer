import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { calculateLineItemAmount } from '@/lib/calculations/documentTotals'
import { formatTHB } from '@/lib/utils/currency'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { DocumentFormValues } from '@/lib/validations/document'

interface LineItemEditorProps {
  control: Control<DocumentFormValues>
  register: UseFormRegister<DocumentFormValues>
  errors: FieldErrors<DocumentFormValues>
  disabled?: boolean
}

const EMPTY_ITEM: DocumentFormValues['items'][number] = {
  description: '',
  quantity: 1,
  unit: '',
  unitPrice: 0,
  discountType: 'AMOUNT',
  discountValue: 0,
}

export function LineItemEditor({ control, register, errors, disabled = false }: LineItemEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">รายการสินค้า/บริการ</p>
        {!disabled && (
          <Button type="button" size="sm" variant="secondary" onClick={() => append(EMPTY_ITEM)}>
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มรายการ
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
          ยังไม่มีรายการ — เพิ่มรายการสินค้า/บริการได้ที่นี่
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const item = watchedItems?.[index]
            const amount = item
              ? calculateLineItemAmount({
                  quantity: Number(item.quantity) || 0,
                  unitPrice: Number(item.unitPrice) || 0,
                  discountType: item.discountType,
                  discountValue: Number(item.discountValue) || 0,
                })
              : 0
            const itemErrors = errors.items?.[index]

            return (
              <div key={field.id} className="rounded-xl border border-line p-3 sm:p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-12">
                    <FormField
                      label="รายการ"
                      htmlFor={`item-${index}-description`}
                      error={itemErrors?.description?.message}
                    >
                      <Input
                        id={`item-${index}-description`}
                        placeholder="ค่าบริการที่ปรึกษาระบบบัญชี"
                        disabled={disabled}
                        {...register(`items.${index}.description`)}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField label="จำนวน" htmlFor={`item-${index}-quantity`} error={itemErrors?.quantity?.message}>
                      <Input
                        id={`item-${index}-quantity`}
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={disabled}
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField label="หน่วย" htmlFor={`item-${index}-unit`} error={itemErrors?.unit?.message}>
                      <Input
                        id={`item-${index}-unit`}
                        placeholder="ชิ้น"
                        disabled={disabled}
                        {...register(`items.${index}.unit`)}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField
                      label="ราคา/หน่วย"
                      htmlFor={`item-${index}-unitPrice`}
                      error={itemErrors?.unitPrice?.message}
                    >
                      <Input
                        id={`item-${index}-unitPrice`}
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={disabled}
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField
                      label="ประเภทส่วนลด"
                      htmlFor={`item-${index}-discountType`}
                    >
                      <Select id={`item-${index}-discountType`} disabled={disabled} {...register(`items.${index}.discountType`)}>
                        <option value="AMOUNT">จำนวนเงิน (บาท)</option>
                        <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
                      </Select>
                    </FormField>
                  </div>

                  <div className="sm:col-span-4">
                    <FormField
                      label="ส่วนลด"
                      htmlFor={`item-${index}-discountValue`}
                      error={itemErrors?.discountValue?.message}
                    >
                      <Input
                        id={`item-${index}-discountValue`}
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={disabled}
                        {...register(`items.${index}.discountValue`, { valueAsNumber: true })}
                      />
                    </FormField>
                  </div>

                  <div className="flex items-end justify-between gap-2 sm:col-span-5">
                    <div>
                      <p className="text-xs text-ink-muted">จำนวนเงิน</p>
                      <p className="font-medium text-ink">{formatTHB(amount)}</p>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label="ลบรายการนี้"
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
    </div>
  )
}
