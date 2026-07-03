import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { DocumentTotalsResult } from '@/lib/calculations/documentTotals'
import { formatTHB } from '@/lib/utils/currency'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { DocumentFormValues } from '@/lib/validations/document'
import type { VatMode } from '@/types/document'

interface FinancialSummaryProps {
  register: UseFormRegister<DocumentFormValues>
  errors: FieldErrors<DocumentFormValues>
  totals: DocumentTotalsResult
  vatMode: VatMode
  disabled?: boolean
}

export function FinancialSummary({ register, errors, totals, vatMode, disabled = false }: FinancialSummaryProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <p className="text-sm font-medium text-ink">สรุปยอดเงิน</p>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-muted">รวมเป็นเงิน</span>
        <span className="text-ink">{formatTHB(totals.subtotal)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <FormField
          label="ส่วนลดท้ายบิล"
          htmlFor="document-discount-value"
          error={errors.documentDiscountValue?.message}
        >
          <Input
            id="document-discount-value"
            type="number"
            step="0.01"
            min="0"
            disabled={disabled}
            {...register('documentDiscountValue', { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="ประเภทส่วนลด" htmlFor="document-discount-type">
          <Select id="document-discount-type" disabled={disabled} {...register('documentDiscountType')}>
            <option value="AMOUNT">จำนวนเงิน (บาท)</option>
            <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
          </Select>
        </FormField>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-muted">ส่วนลดท้ายบิล</span>
        <span className="text-ink">-{formatTHB(totals.discountTotal)}</span>
      </div>

      {vatMode !== 'NON_VAT' && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            {vatMode === 'VAT_INCLUDED' ? 'ภาษีมูลค่าเพิ่ม (รวมในราคาแล้ว)' : 'ภาษีมูลค่าเพิ่ม 7%'}
          </span>
          <span className="text-ink">{formatTHB(totals.vatAmount)}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="font-medium text-ink">ยอดรวมทั้งสิ้น</span>
        <span className="text-lg font-semibold text-ink">{formatTHB(totals.grandTotal)}</span>
      </div>
    </div>
  )
}
