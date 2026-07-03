import type { DocumentTotalsResult } from '@/lib/calculations/documentTotals'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import type { VatMode } from '@/types/document'

interface PreviewItem {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
}

interface DocumentPreviewProps {
  companyName: string
  companyAddress?: string | null
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
}: DocumentPreviewProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="font-semibold text-ink">{companyName}</p>
          {companyAddress && <p className="mt-0.5 text-xs text-ink-muted">{companyAddress}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold text-ink">{documentTypeLabel}</p>
          {documentNumber ? (
            <p className="mt-0.5 text-xs font-medium text-ink">{documentNumber}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-ink-muted">จะออกเลขเมื่ออนุมัติ</p>
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
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
          <span>ยอดรวมทั้งสิ้น</span>
          <span>{formatTHB(totals.grandTotal)}</span>
        </div>
      </div>

      {note && <p className="mt-4 whitespace-pre-wrap text-xs text-ink-muted">หมายเหตุ: {note}</p>}
    </div>
  )
}
