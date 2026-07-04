import { calculateInstallmentAmount, type DocumentTotalsResult, type InstallmentAmountType } from '@/lib/calculations/documentTotals'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { getTemplatePalette } from '@/lib/templates/previewPalette'
import { withSignatureFallback } from '@/lib/signatures/defaultSignatureSlots'
import type { VatMode } from '@/types/document'
import type { DocumentTemplateEnum } from '@/types/database'
import type { SignatureSlot } from '@/types/signature'

interface PreviewItem {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
}

interface PreviewInstallment {
  installmentNo?: number
  amountType?: InstallmentAmountType
  amountValue?: number
  dueDate?: string | null
  note?: string | null
}

interface DocumentPreviewProps {
  companyName: string
  companyAddress?: string | null
  /** Public URL of the company's logo (Settings > ข้อมูลบริษัท) — renders next to the company name when present, nothing when absent. */
  logoUrl?: string | null
  /** Defaults to EXECUTIVE_CLASSIC, matching the PDF generator's own fallback (src/lib/pdf/generateDocumentPdf.tsx). */
  template?: DocumentTemplateEnum | null
  documentTypeLabel: string
  /** Null/omitted while DRAFT — shows "จะออกเลขเมื่ออนุมัติ" instead (Phase 4B: real number once APPROVED/PAID/CANCELLED). */
  documentNumber?: string | null
  customerName?: string | null
  customerAddress?: string | null
  issueDate: string
  dueDate?: string | null
  items: PreviewItem[]
  totals: DocumentTotalsResult
  vatMode: VatMode
  note?: string | null
  /** Company's configured signature slots — falls back to ผู้ซื้อ/ผู้ขาย when omitted or empty. */
  signatureSlots?: SignatureSlot[]
  /** Defaults to FULL — when INSTALLMENT, an installment table renders between line items and totals. */
  installmentPlan?: 'FULL' | 'INSTALLMENT'
  installments?: PreviewInstallment[]
}

/**
 * A live, on-screen preview of a document — not a printable/exportable
 * document (PDF export is Phase 5A). Used both while editing a Draft
 * (DocumentForm, no documentNumber yet) and on the read-only detail page
 * (DocumentDetailPage, Phase 4B) once a real document_number exists.
 */
export function DocumentPreview({
  companyName,
  companyAddress,
  logoUrl,
  template,
  documentTypeLabel,
  documentNumber,
  customerName,
  customerAddress,
  issueDate,
  dueDate,
  items,
  totals,
  vatMode,
  note,
  signatureSlots,
  installmentPlan,
  installments,
}: DocumentPreviewProps) {
  const palette = getTemplatePalette(template)
  const slots = withSignatureFallback(signatureSlots ?? [])
  const showInstallments = installmentPlan === 'INSTALLMENT' && (installments?.length ?? 0) > 0

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div
        className="flex flex-wrap items-start justify-between gap-3 rounded-lg p-4"
        style={{
          backgroundColor: palette.header,
          color: palette.headerText,
          border: palette.headerBorderColor ? `1.5px solid ${palette.headerBorderColor}` : undefined,
        }}
      >
        <div className="flex items-start gap-3">
          {logoUrl && (
            <img src={logoUrl} alt="" className="size-10 shrink-0 rounded bg-white object-contain" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold">{companyName}</p>
            {companyAddress && <p className="mt-0.5 text-xs opacity-85">{companyAddress}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold">{documentTypeLabel}</p>
          {documentNumber ? (
            <p className="mt-0.5 text-xs font-medium">{documentNumber}</p>
          ) : (
            <p className="mt-0.5 text-xs italic opacity-85">จะออกเลขเมื่ออนุมัติ</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
        <div>
          <p className="text-xs text-ink-muted">ลูกค้า</p>
          <p className="text-ink">{customerName || '—'}</p>
          {customerAddress && <p className="text-xs text-ink-muted">{customerAddress}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-muted">วันที่ออกเอกสาร</p>
          <p className="text-ink">{issueDate ? formatThaiDate(issueDate) : '—'}</p>
          {dueDate && (
            <>
              <p className="mt-1 text-xs text-ink-muted">ครบกำหนด</p>
              <p className="text-ink">{formatThaiDate(dueDate)}</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              <th className="py-2 font-medium">รายการ</th>
              <th className="py-2 text-right font-medium">จำนวน</th>
              <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
              <th className="py-2 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-muted">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2 pr-2">{item.description || '—'}</td>
                  <td className="py-2 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 text-right">{formatTHB(item.unitPrice)}</td>
                  <td className="py-2 text-right">{formatTHB(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showInstallments && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs font-medium text-ink-muted">เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="py-2 font-medium">งวดที่</th>
                <th className="py-2 font-medium">รายละเอียด</th>
                <th className="py-2 font-medium">ครบกำหนด</th>
                <th className="py-2 text-right font-medium">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(installments ?? []).map((installment, index) => (
                <tr key={index}>
                  <td className="py-2 pr-2">{installment.installmentNo ?? index + 1}</td>
                  <td className="py-2 pr-2">{installment.note || '—'}</td>
                  <td className="py-2 pr-2">
                    {installment.dueDate ? formatThaiDate(installment.dueDate) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {formatTHB(
                      calculateInstallmentAmount(
                        installment.amountType ?? 'PERCENT',
                        Number(installment.amountValue) || 0,
                        totals.grandTotal,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">รวมเป็นเงิน</span>
          <span className="text-ink">{formatTHB(totals.subtotal)}</span>
        </div>
        {totals.discountTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">ส่วนลด</span>
            <span className="text-ink">-{formatTHB(totals.discountTotal)}</span>
          </div>
        )}
        {vatMode !== 'NON_VAT' && (
          <div className="flex justify-between">
            <span className="text-ink-muted">ภาษีมูลค่าเพิ่ม</span>
            <span className="text-ink">{formatTHB(totals.vatAmount)}</span>
          </div>
        )}
        <div
          className="flex justify-between rounded-lg px-3 py-2 text-base font-semibold"
          style={{
            backgroundColor: palette.totalBg,
            color: palette.grandTotalTextColor,
            border: palette.headerBorderColor ? `1px solid ${palette.headerBorderColor}` : undefined,
          }}
        >
          <span>ยอดรวมทั้งสิ้น</span>
          <span>{formatTHB(totals.grandTotal)}</span>
        </div>
      </div>

      {note && <p className="mt-4 whitespace-pre-wrap text-xs text-ink-muted">หมายเหตุ: {note}</p>}

      <div className="mt-8 flex flex-wrap justify-between gap-6">
        {slots.map((slot) => (
          <div key={slot.id} className="w-40 text-center">
            <div className="h-10 border-b border-line" />
            <p className="mt-1.5 text-xs text-ink-muted">{slot.label}</p>
            <p className="mt-2 text-[10px] text-ink-muted/70">วันที่ ____________</p>
          </div>
        ))}
      </div>
    </div>
  )
}
