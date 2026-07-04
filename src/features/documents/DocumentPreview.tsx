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

/** Everything every template layout needs, pre-derived once so the 3 layout components below stay pure rendering. */
interface PreparedPreviewData {
  companyName: string
  companyAddress?: string | null
  logoUrl?: string | null
  documentTypeLabel: string
  documentNumber?: string | null
  customerName?: string | null
  customerAddress?: string | null
  issueDate: string
  dueDate?: string | null
  items: PreviewItem[]
  totals: DocumentTotalsResult
  vatMode: VatMode
  note?: string | null
  slots: SignatureSlot[]
  showInstallments: boolean
  installments: PreviewInstallment[]
  accent: string
  accentText: string
}

function installmentAmount(installment: PreviewInstallment, grandTotal: number): number {
  return calculateInstallmentAmount(installment.amountType ?? 'PERCENT', Number(installment.amountValue) || 0, grandTotal)
}

/**
 * Template 1 — Formal Thai business style (boxed, official). Modeled on
 * the traditional Thai accounting-software look: a heavy outer border, a
 * centered company/document header, bordered customer/metadata boxes, a
 * strong-grid item table, a boxed grand-total, and bordered signature
 * boxes — everything is boxed, nothing floats free.
 */
function FormalTemplate(data: PreparedPreviewData) {
  const { accent, accentText } = data
  return (
    <div className="border-2 border-slate-800 bg-white text-sm">
      <div className="border-b-2 border-slate-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center">
            {data.logoUrl && <img src={data.logoUrl} alt="" className="max-h-14 max-w-14 object-contain" />}
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-slate-900">{data.companyName}</p>
            {data.companyAddress && <p className="mt-0.5 text-xs text-slate-600">{data.companyAddress}</p>}
          </div>
          <div className="size-14 shrink-0" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center">
          <span
            className="inline-block rounded px-4 py-1 text-sm font-bold"
            style={{ backgroundColor: accent, color: accentText }}
          >
            {data.documentTypeLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-slate-800 border-b-2 border-slate-800">
        <div className="p-3">
          <p className="text-xs font-semibold text-slate-500">ลูกค้า</p>
          <p className="font-medium text-slate-900">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs text-slate-600">{data.customerAddress}</p>}
        </div>
        <div className="p-3">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">เลขที่เอกสาร</span>
            <span className="font-medium text-slate-900">{data.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-xs text-slate-500">วันที่ออกเอกสาร</span>
            <span className="text-slate-900">{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</span>
          </div>
          {data.dueDate && (
            <div className="mt-1 flex justify-between">
              <span className="text-xs text-slate-500">ครบกำหนด</span>
              <span className="text-slate-900">{formatThaiDate(data.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-2 font-medium">รายการ</th>
              <th className="border border-slate-800 p-2 text-right font-medium">จำนวน</th>
              <th className="border border-slate-800 p-2 text-right font-medium">ราคา/หน่วย</th>
              <th className="border border-slate-800 p-2 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-800 p-4 text-center text-slate-500">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : (
              data.items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-slate-800 p-2">{item.description || '—'}</td>
                  <td className="border border-slate-800 p-2 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="border border-slate-800 p-2 text-right">{formatTHB(item.unitPrice)}</td>
                  <td className="border border-slate-800 p-2 text-right">{formatTHB(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data.showInstallments && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 p-2 font-medium">งวดที่</th>
                  <th className="border border-slate-800 p-2 font-medium">รายละเอียด</th>
                  <th className="border border-slate-800 p-2 font-medium">ครบกำหนด</th>
                  <th className="border border-slate-800 p-2 text-right font-medium">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {data.installments.map((installment, index) => (
                  <tr key={index}>
                    <td className="border border-slate-800 p-2">{installment.installmentNo ?? index + 1}</td>
                    <td className="border border-slate-800 p-2">{installment.note || '—'}</td>
                    <td className="border border-slate-800 p-2">
                      {installment.dueDate ? formatThaiDate(installment.dueDate) : '—'}
                    </td>
                    <td className="border border-slate-800 p-2 text-right">
                      {formatTHB(installmentAmount(installment, data.totals.grandTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end px-3 pb-3">
        <div className="w-full max-w-72 border-2 border-slate-800">
          <div className="flex justify-between border-b border-slate-800 p-2">
            <span className="text-slate-600">รวมเป็นเงิน</span>
            <span className="text-slate-900">{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between border-b border-slate-800 p-2">
              <span className="text-slate-600">ส่วนลด</span>
              <span className="text-slate-900">-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between border-b border-slate-800 p-2">
              <span className="text-slate-600">ภาษีมูลค่าเพิ่ม</span>
              <span className="text-slate-900">{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between p-2 font-bold" style={{ backgroundColor: accent, color: accentText }}>
            <span>ยอดรวมทั้งสิ้น</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && (
        <p className="whitespace-pre-wrap border-t-2 border-slate-800 p-3 text-xs text-slate-600">หมายเหตุ: {data.note}</p>
      )}

      <div className="flex flex-wrap gap-3 border-t-2 border-slate-800 p-3">
        {data.slots.map((slot) => (
          <div key={slot.id} className="min-w-40 flex-1 border border-slate-800 p-3 text-center">
            <div className="h-10" />
            <p className="border-t border-slate-800 pt-1.5 text-xs font-medium text-slate-700">{slot.label}</p>
            <p className="mt-1 text-[10px] text-slate-500">วันที่ ____________</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Template 2 — Clean modern style. Spacious, mostly white, no borders
 * boxing anything in; logo/company info sits top-left, the document
 * title and metadata sit top-right, and a single warm accent color marks
 * the title and the grand-total pill — everything else stays plain.
 */
function ModernTemplate(data: PreparedPreviewData) {
  const { accent, accentText } = data
  return (
    <div className="bg-white p-5 text-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {data.logoUrl && <img src={data.logoUrl} alt="" className="size-12 shrink-0 object-contain" />}
          <div>
            <p className="text-base font-semibold text-slate-900">{data.companyName}</p>
            {data.companyAddress && <p className="mt-0.5 text-xs text-slate-500">{data.companyAddress}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light tracking-wide" style={{ color: accent }}>
            {data.documentTypeLabel}
          </p>
          {data.documentNumber ? (
            <p className="mt-0.5 text-sm font-medium text-slate-700">{data.documentNumber}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-slate-400">จะออกเลขเมื่ออนุมัติ</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">ลูกค้า</p>
          <p className="mt-0.5 font-medium text-slate-900">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs text-slate-500">{data.customerAddress}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">วันที่ออกเอกสาร</p>
          <p className="mt-0.5 text-slate-900">{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</p>
          {data.dueDate && (
            <>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">ครบกำหนด</p>
              <p className="text-slate-900">{formatThaiDate(data.dueDate)}</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-wide text-slate-400" style={{ borderBottom: `2px solid ${accent}` }}>
              <th className="pb-2">รายการ</th>
              <th className="pb-2 text-right">จำนวน</th>
              <th className="pb-2 text-right">ราคา/หน่วย</th>
              <th className="pb-2 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : (
              data.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2.5 pr-2 text-slate-800">{item.description || '—'}</td>
                  <td className="py-2.5 text-right text-slate-800">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2.5 text-right text-slate-800">{formatTHB(item.unitPrice)}</td>
                  <td className="py-2.5 text-right text-slate-800">{formatTHB(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data.showInstallments && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: accent }}>
              เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-slate-400" style={{ borderBottom: `2px solid ${accent}` }}>
                  <th className="pb-2">งวดที่</th>
                  <th className="pb-2">รายละเอียด</th>
                  <th className="pb-2">ครบกำหนด</th>
                  <th className="pb-2 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.installments.map((installment, index) => (
                  <tr key={index}>
                    <td className="py-2.5 pr-2 text-slate-800">{installment.installmentNo ?? index + 1}</td>
                    <td className="py-2.5 pr-2 text-slate-800">{installment.note || '—'}</td>
                    <td className="py-2.5 pr-2 text-slate-800">
                      {installment.dueDate ? formatThaiDate(installment.dueDate) : '—'}
                    </td>
                    <td className="py-2.5 text-right text-slate-800">
                      {formatTHB(installmentAmount(installment, data.totals.grandTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-72 space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>รวมเป็นเงิน</span>
            <span>{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>ส่วนลด</span>
              <span>-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between text-slate-600">
              <span>ภาษีมูลค่าเพิ่ม</span>
              <span>{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div
            className="flex justify-between rounded-full px-4 py-2 text-base font-semibold"
            style={{ backgroundColor: accent, color: accentText }}
          >
            <span>ยอดรวมทั้งสิ้น</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && <p className="mt-6 whitespace-pre-wrap text-xs text-slate-500">หมายเหตุ: {data.note}</p>}

      <div className="mt-12 flex flex-wrap justify-between gap-8">
        {data.slots.map((slot) => (
          <div key={slot.id} className="min-w-36 flex-1 text-center">
            <div className="h-px w-full" style={{ backgroundColor: accent }} />
            <p className="mt-2 text-xs font-medium text-slate-600">{slot.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Template 3 — Minimal black-line official form. Deliberately the plainest
 * of the three: one thin black border around the whole document, plain
 * black text throughout, boxed customer/document-info like a government
 * form, a simple item grid, and signature lines (not boxes) at the
 * bottom. No color anywhere, not even for the grand total.
 */
function MinimalTemplate(data: PreparedPreviewData) {
  return (
    <div className="border border-black bg-white p-4 text-sm text-black">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black pb-3">
        <div className="flex items-start gap-2">
          {data.logoUrl && <img src={data.logoUrl} alt="" className="size-10 shrink-0 object-contain grayscale" />}
          <div>
            <p className="font-bold">{data.companyName}</p>
            {data.companyAddress && <p className="text-xs">{data.companyAddress}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold">{data.documentTypeLabel}</p>
          <p className="text-xs">{data.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
        <div className="p-2">
          <p className="text-xs">ลูกค้า</p>
          <p className="font-medium">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs">{data.customerAddress}</p>}
        </div>
        <div className="p-2">
          <div className="flex justify-between text-xs">
            <span>วันที่ออกเอกสาร</span>
            <span>{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</span>
          </div>
          {data.dueDate && (
            <div className="mt-1 flex justify-between text-xs">
              <span>ครบกำหนด</span>
              <span>{formatThaiDate(data.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto py-2">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border border-black p-1.5 font-medium">รายการ</th>
              <th className="border border-black p-1.5 text-right font-medium">จำนวน</th>
              <th className="border border-black p-1.5 text-right font-medium">ราคา/หน่วย</th>
              <th className="border border-black p-1.5 text-right font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-black p-4 text-center">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : (
              data.items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-black p-1.5">{item.description || '—'}</td>
                  <td className="border border-black p-1.5 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="border border-black p-1.5 text-right">{formatTHB(item.unitPrice)}</td>
                  <td className="border border-black p-1.5 text-right">{formatTHB(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data.showInstallments && (
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium">เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border border-black p-1.5 font-medium">งวดที่</th>
                  <th className="border border-black p-1.5 font-medium">รายละเอียด</th>
                  <th className="border border-black p-1.5 font-medium">ครบกำหนด</th>
                  <th className="border border-black p-1.5 text-right font-medium">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {data.installments.map((installment, index) => (
                  <tr key={index}>
                    <td className="border border-black p-1.5">{installment.installmentNo ?? index + 1}</td>
                    <td className="border border-black p-1.5">{installment.note || '—'}</td>
                    <td className="border border-black p-1.5">
                      {installment.dueDate ? formatThaiDate(installment.dueDate) : '—'}
                    </td>
                    <td className="border border-black p-1.5 text-right">
                      {formatTHB(installmentAmount(installment, data.totals.grandTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-black pt-2">
        <div className="w-full max-w-64 space-y-1">
          <div className="flex justify-between">
            <span>รวมเป็นเงิน</span>
            <span>{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between">
              <span>ส่วนลด</span>
              <span>-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between">
              <span>ภาษีมูลค่าเพิ่ม</span>
              <span>{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-1 font-bold">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && <p className="mt-3 whitespace-pre-wrap border-t border-black pt-2 text-xs">หมายเหตุ: {data.note}</p>}

      <div className="mt-6 flex flex-wrap gap-6">
        {data.slots.map((slot) => (
          <div key={slot.id} className="min-w-32 flex-1 text-center">
            <div className="h-10 border-b border-black" />
            <p className="mt-1 text-xs">{slot.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A live, on-screen preview of a document — not a printable/exportable
 * document (PDF export is Phase 5A). Used both while editing a Draft
 * (DocumentForm, no documentNumber yet) and on the read-only detail page
 * (DocumentDetailPage, Phase 4B) once a real document_number exists.
 *
 * Renders one of 3 structurally distinct layouts (production readiness
 * pass 2 redesign) — not just a color swap on one shared layout — see
 * FormalTemplate/ModernTemplate/MinimalTemplate above, mirrored exactly
 * in src/lib/pdf/DocumentPdf.tsx for the exported PDF.
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
  const data: PreparedPreviewData = {
    companyName,
    companyAddress,
    logoUrl,
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
    slots: withSignatureFallback(signatureSlots ?? []),
    showInstallments: installmentPlan === 'INSTALLMENT' && (installments?.length ?? 0) > 0,
    installments: installments ?? [],
    accent: palette.accent,
    accentText: palette.accentText,
  }

  if (template === 'MODERN_ACCENT') return <ModernTemplate {...data} />
  if (template === 'MINIMAL_PRINT') return <MinimalTemplate {...data} />
  return <FormalTemplate {...data} />
}
