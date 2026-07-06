import type { CSSProperties } from 'react'
import { calculateInstallmentAmount, type DocumentTotalsResult, type InstallmentAmountType } from '@/lib/calculations/documentTotals'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { thaiBahtText } from '@/lib/utils/thaiBahtText'
import { getTemplatePalette } from '@/lib/templates/previewPalette'
import { DEFAULT_DOCUMENT_TEMPLATE_TEXT } from '@/lib/templates/documentTemplateText'
import { withSignatureFallback } from '@/lib/signatures/defaultSignatureSlots'
import { CompanyLogo } from '@/components/shared/CompanyLogo'
import { LOGO_SIZE_DEFAULT, clampLogoSize, isCenteredCompanyHeader, shouldRenderLogoAtSlot, type LogoPosition } from '@/types/logoLayout'
import type { VatMode } from '@/types/document'
import type { DocumentTemplateEnum } from '@/types/database'
import type { SignatureSlot } from '@/types/signature'

const T = DEFAULT_DOCUMENT_TEMPLATE_TEXT

/**
 * The one place all 3 templates render a signature slot: a blank space to
 * physically sign, the signature line itself, the "(________________________)"
 * printed-name placeholder, then the role label -- always in that order,
 * always centered, never beside/outside the slot's own box. Previously
 * each template hand-rolled this and drifted (Modern Accent was missing
 * the blank signing space above its line); centralizing it here makes
 * that impossible to reintroduce.
 */
function SignatureBlock({
  slot,
  boxClassName,
  lineClassName,
  lineStyle,
  placeholderClassName,
  labelClassName,
}: {
  slot: SignatureSlot
  boxClassName: string
  lineClassName: string
  lineStyle?: CSSProperties
  placeholderClassName: string
  labelClassName: string
}) {
  return (
    <div className={boxClassName}>
      <div className="flex flex-col items-center">
        <div className="h-10" />
        <div className={lineClassName} style={lineStyle} />
        <p className={placeholderClassName}>(________________________)</p>
        <p className={labelClassName}>{slot.label}</p>
      </div>
    </div>
  )
}

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
  /** Only rendered for the centered_logo_above_company layout, which shows these as separate centered lines below the logo — every other layout keeps its existing combined tax-ID/phone line untouched. */
  companyTaxId?: string | null
  companyPhone?: string | null
  /** Public URL of the company's logo (Settings > ข้อมูลบริษัท) — renders next to the company name when present, nothing when absent. */
  logoUrl?: string | null
  /** Side length (px) of the logo's bounding box — see src/types/logoLayout.ts. Defaults to LOGO_SIZE_DEFAULT. */
  logoSize?: number
  /** Which header slot the logo renders at (Pass 2.1) — see src/types/logoLayout.ts. Defaults to left_of_company_name (today's placement). */
  logoPosition?: LogoPosition
  /** Defaults to EXECUTIVE_CLASSIC. */
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
  companyTaxId?: string | null
  companyPhone?: string | null
  logoUrl?: string | null
  logoSize: number
  logoPosition: LogoPosition
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
  // Both left/right slots always reserve this same width, whichever one
  // (if either) actually holds the logo — so the centered company name
  // stays perfectly centered regardless of logoPosition or logoSize.
  const logoBoxPx = clampLogoSize(data.logoSize)
  const isStacked = isCenteredCompanyHeader(data.logoPosition)
  const isLeftAligned = shouldRenderLogoAtSlot(data.logoPosition, 'left')
  return (
    <div className="border-2 border-slate-800 bg-white text-sm">
      <div className="border-b-2 border-slate-800 p-4">
        {shouldRenderLogoAtSlot(data.logoPosition, 'center') && (
          <div className="mb-2 flex justify-center">
            <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
          </div>
        )}
        {isStacked ? (
          <div className="flex flex-col items-center gap-0.5 text-center">
            <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
            <p className="mt-1 text-lg font-bold text-slate-900">{data.companyName}</p>
            {data.companyAddress && <p className="text-xs text-slate-600">{data.companyAddress}</p>}
            {data.companyTaxId && <p className="text-xs text-slate-600">เลขประจำตัวผู้เสียภาษี {data.companyTaxId}</p>}
            {data.companyPhone && <p className="text-xs text-slate-600">โทร {data.companyPhone}</p>}
          </div>
        ) : isLeftAligned ? (
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center" style={{ width: logoBoxPx, height: logoBoxPx }}>
              <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{data.companyName}</p>
              {data.companyAddress && <p className="mt-0.5 text-xs text-slate-600">{data.companyAddress}</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: logoBoxPx, height: logoBoxPx }}
              aria-hidden="true"
            />
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-slate-900">{data.companyName}</p>
              {data.companyAddress && <p className="mt-0.5 text-xs text-slate-600">{data.companyAddress}</p>}
            </div>
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: logoBoxPx, height: logoBoxPx }}
            >
              {shouldRenderLogoAtSlot(data.logoPosition, 'right') && (
                <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
              )}
            </div>
          </div>
        )}
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
          <p className="text-xs font-semibold text-slate-500">{T.customerLabel}</p>
          <p className="font-medium text-slate-900">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs text-slate-600">{data.customerAddress}</p>}
        </div>
        <div className="p-3">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">{T.documentNumberLabel}</span>
            <span className="font-medium text-slate-900">{data.documentNumber ?? T.pendingDocumentNumberLabel}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-xs text-slate-500">{T.issueDateLabel}</span>
            <span className="text-slate-900">{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</span>
          </div>
          {data.dueDate && (
            <div className="mt-1 flex justify-between">
              <span className="text-xs text-slate-500">{T.dueDateLabel}</span>
              <span className="text-slate-900">{formatThaiDate(data.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-2 font-medium">{T.itemDescriptionLabel}</th>
              <th className="border border-slate-800 p-2 text-right font-medium">{T.itemQuantityLabel}</th>
              <th className="border border-slate-800 p-2 text-right font-medium">{T.itemUnitPriceLabel}</th>
              <th className="border border-slate-800 p-2 text-right font-medium">{T.itemAmountLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-800 p-4 text-center text-slate-500">
                  {T.noItemsLabel}
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
            <p className="mb-1 text-xs font-semibold text-slate-500">{T.installmentSectionLabel}</p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 p-2 font-medium">{T.installmentNoLabel}</th>
                  <th className="border border-slate-800 p-2 font-medium">{T.installmentDetailLabel}</th>
                  <th className="border border-slate-800 p-2 font-medium">{T.dueDateLabel}</th>
                  <th className="border border-slate-800 p-2 text-right font-medium">{T.itemAmountLabel}</th>
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

      <div className="flex flex-wrap items-end justify-between gap-3 px-3 pb-3">
        <p className="flex-1 text-xs italic text-slate-500">({thaiBahtText(data.totals.grandTotal)})</p>
        <div className="w-full max-w-72 border-2 border-slate-800">
          <div className="flex justify-between border-b border-slate-800 p-2">
            <span className="text-slate-600">{T.subtotalLabel}</span>
            <span className="text-slate-900">{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between border-b border-slate-800 p-2">
              <span className="text-slate-600">{T.discountLabel}</span>
              <span className="text-slate-900">-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between border-b border-slate-800 p-2">
              <span className="text-slate-600">{T.vatLabel}</span>
              <span className="text-slate-900">{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between p-2 font-bold" style={{ backgroundColor: accent, color: accentText }}>
            <span>{T.grandTotalLabel}</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && (
        <p className="whitespace-pre-wrap border-t-2 border-slate-800 p-3 text-xs text-slate-600">
          {T.noteLabel}: {data.note}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t-2 border-slate-800 p-3">
        {data.slots.map((slot) => (
          <SignatureBlock
            key={slot.id}
            slot={slot}
            boxClassName="min-w-40 flex-1 border border-slate-800 p-3"
            lineClassName="w-full border-t border-slate-800"
            placeholderClassName="mt-1.5 text-xs text-slate-600"
            labelClassName="mt-1 text-xs font-medium text-slate-700"
          />
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
  const isStacked = isCenteredCompanyHeader(data.logoPosition)
  return (
    <div className="bg-white p-5 text-sm sm:p-7">
      {shouldRenderLogoAtSlot(data.logoPosition, 'center') && (
        <div className="mb-4 flex justify-center">
          <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
        </div>
      )}
      {isStacked ? (
        <div className="flex flex-col items-center gap-0.5 text-center">
          <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
          <p className="mt-2 text-base font-semibold text-slate-900">{data.companyName}</p>
          {data.companyAddress && <p className="text-xs text-slate-500">{data.companyAddress}</p>}
          {data.companyTaxId && <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี {data.companyTaxId}</p>}
          {data.companyPhone && <p className="text-xs text-slate-500">โทร {data.companyPhone}</p>}
          <div className="mt-3">
            <p className="text-2xl font-light tracking-wide" style={{ color: accent }}>
              {data.documentTypeLabel}
            </p>
            {data.documentNumber ? (
              <p className="mt-0.5 text-sm font-medium text-slate-700">{data.documentNumber}</p>
            ) : (
              <p className="mt-0.5 text-xs italic text-slate-400">{T.pendingDocumentNumberLabel}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            {shouldRenderLogoAtSlot(data.logoPosition, 'left') && (
              <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
            )}
            <div>
              <p className="text-base font-semibold text-slate-900">{data.companyName}</p>
              {data.companyAddress && <p className="mt-0.5 text-xs text-slate-500">{data.companyAddress}</p>}
            </div>
          </div>
          <div className="text-right">
            {shouldRenderLogoAtSlot(data.logoPosition, 'right') && (
              <div className="mb-2 flex justify-end">
                <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} />
              </div>
            )}
            <p className="text-2xl font-light tracking-wide" style={{ color: accent }}>
              {data.documentTypeLabel}
            </p>
            {data.documentNumber ? (
              <p className="mt-0.5 text-sm font-medium text-slate-700">{data.documentNumber}</p>
            ) : (
              <p className="mt-0.5 text-xs italic text-slate-400">{T.pendingDocumentNumberLabel}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{T.customerLabel}</p>
          <p className="mt-0.5 font-medium text-slate-900">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs text-slate-500">{data.customerAddress}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{T.issueDateLabel}</p>
          <p className="mt-0.5 text-slate-900">{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</p>
          {data.dueDate && (
            <>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{T.dueDateLabel}</p>
              <p className="text-slate-900">{formatThaiDate(data.dueDate)}</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-wide text-slate-400" style={{ borderBottom: `2px solid ${accent}` }}>
              <th className="pb-2">{T.itemDescriptionLabel}</th>
              <th className="pb-2 text-right">{T.itemQuantityLabel}</th>
              <th className="pb-2 text-right">{T.itemUnitPriceLabel}</th>
              <th className="pb-2 text-right">{T.itemAmountLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  {T.noItemsLabel}
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
              {T.installmentSectionLabel}
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-slate-400" style={{ borderBottom: `2px solid ${accent}` }}>
                  <th className="pb-2">{T.installmentNoLabel}</th>
                  <th className="pb-2">{T.installmentDetailLabel}</th>
                  <th className="pb-2">{T.dueDateLabel}</th>
                  <th className="pb-2 text-right">{T.itemAmountLabel}</th>
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

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <p className="flex-1 text-xs italic text-slate-400">({thaiBahtText(data.totals.grandTotal)})</p>
        <div className="w-full max-w-72 space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>{T.subtotalLabel}</span>
            <span>{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>{T.discountLabel}</span>
              <span>-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between text-slate-600">
              <span>{T.vatLabel}</span>
              <span>{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div
            className="flex justify-between rounded-full px-4 py-2 text-base font-semibold"
            style={{ backgroundColor: accent, color: accentText }}
          >
            <span>{T.grandTotalLabel}</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && (
        <p className="mt-6 whitespace-pre-wrap text-xs text-slate-500">
          {T.noteLabel}: {data.note}
        </p>
      )}

      <div className="mt-12 flex flex-wrap justify-between gap-8">
        {data.slots.map((slot) => (
          <SignatureBlock
            key={slot.id}
            slot={slot}
            boxClassName="min-w-36 flex-1"
            lineClassName="h-px w-full"
            lineStyle={{ backgroundColor: accent }}
            placeholderClassName="mt-1.5 text-xs text-slate-500"
            labelClassName="mt-1 text-xs font-medium text-slate-600"
          />
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
  const isStacked = isCenteredCompanyHeader(data.logoPosition)
  return (
    <div className="border border-black bg-white p-4 text-sm text-black">
      {shouldRenderLogoAtSlot(data.logoPosition, 'center') && (
        <div className="mb-2 flex justify-center">
          <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} grayscale />
        </div>
      )}
      {isStacked ? (
        <div className="flex flex-col items-center gap-0.5 border-b border-black pb-3 text-center">
          <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} grayscale />
          <p className="mt-1 font-bold">{data.companyName}</p>
          {data.companyAddress && <p className="text-xs">{data.companyAddress}</p>}
          {data.companyTaxId && <p className="text-xs">เลขประจำตัวผู้เสียภาษี {data.companyTaxId}</p>}
          {data.companyPhone && <p className="text-xs">โทร {data.companyPhone}</p>}
          <div className="mt-2">
            <p className="font-bold">{data.documentTypeLabel}</p>
            <p className="text-xs">{data.documentNumber ?? T.pendingDocumentNumberLabel}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black pb-3">
          <div className="flex items-center gap-2">
            {shouldRenderLogoAtSlot(data.logoPosition, 'left') && (
              <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} grayscale />
            )}
            <div>
              <p className="font-bold">{data.companyName}</p>
              {data.companyAddress && <p className="text-xs">{data.companyAddress}</p>}
            </div>
          </div>
          <div className="text-right">
            {shouldRenderLogoAtSlot(data.logoPosition, 'right') && (
              <div className="mb-1 flex justify-end">
                <CompanyLogo logoUrl={data.logoUrl} size={data.logoSize} grayscale />
              </div>
            )}
            <p className="font-bold">{data.documentTypeLabel}</p>
            <p className="text-xs">{data.documentNumber ?? T.pendingDocumentNumberLabel}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
        <div className="p-2">
          <p className="text-xs">{T.customerLabel}</p>
          <p className="font-medium">{data.customerName || '—'}</p>
          {data.customerAddress && <p className="text-xs">{data.customerAddress}</p>}
        </div>
        <div className="p-2">
          <div className="flex justify-between text-xs">
            <span>{T.issueDateLabel}</span>
            <span>{data.issueDate ? formatThaiDate(data.issueDate) : '—'}</span>
          </div>
          {data.dueDate && (
            <div className="mt-1 flex justify-between text-xs">
              <span>{T.dueDateLabel}</span>
              <span>{formatThaiDate(data.dueDate)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto py-2">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border border-black p-1.5 font-medium">{T.itemDescriptionLabel}</th>
              <th className="border border-black p-1.5 text-right font-medium">{T.itemQuantityLabel}</th>
              <th className="border border-black p-1.5 text-right font-medium">{T.itemUnitPriceLabel}</th>
              <th className="border border-black p-1.5 text-right font-medium">{T.itemAmountLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-black p-4 text-center">
                  {T.noItemsLabel}
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
            <p className="mb-1 text-xs font-medium">{T.installmentSectionLabel}</p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border border-black p-1.5 font-medium">{T.installmentNoLabel}</th>
                  <th className="border border-black p-1.5 font-medium">{T.installmentDetailLabel}</th>
                  <th className="border border-black p-1.5 font-medium">{T.dueDateLabel}</th>
                  <th className="border border-black p-1.5 text-right font-medium">{T.itemAmountLabel}</th>
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

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-black pt-2">
        <p className="flex-1 text-xs italic">({thaiBahtText(data.totals.grandTotal)})</p>
        <div className="w-full max-w-64 space-y-1">
          <div className="flex justify-between">
            <span>{T.subtotalLabel}</span>
            <span>{formatTHB(data.totals.subtotal)}</span>
          </div>
          {data.totals.discountTotal > 0 && (
            <div className="flex justify-between">
              <span>{T.discountLabel}</span>
              <span>-{formatTHB(data.totals.discountTotal)}</span>
            </div>
          )}
          {data.vatMode !== 'NON_VAT' && (
            <div className="flex justify-between">
              <span>{T.vatLabel}</span>
              <span>{formatTHB(data.totals.vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-1 font-bold">
            <span>{T.grandTotalLabel}</span>
            <span>{formatTHB(data.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {data.note && (
        <p className="mt-3 whitespace-pre-wrap border-t border-black pt-2 text-xs">
          {T.noteLabel}: {data.note}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-6">
        {data.slots.map((slot) => (
          <SignatureBlock
            key={slot.id}
            slot={slot}
            boxClassName="min-w-32 flex-1"
            lineClassName="w-full border-b border-black"
            placeholderClassName="mt-1.5 text-xs"
            labelClassName="mt-1 text-xs"
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A live preview of a document. Used while editing a Draft (DocumentForm,
 * no documentNumber yet), on the read-only detail page (DocumentDetailPage,
 * Phase 4B) once a real document_number exists, and on the print/export
 * route (DocumentPrintPage) — the same rendering is what gets printed to
 * PDF, so there is only one layout implementation to keep correct.
 *
 * Renders one of 3 structurally distinct layouts (production readiness
 * pass 2 redesign) — not just a color swap on one shared layout — see
 * FormalTemplate/ModernTemplate/MinimalTemplate above.
 */
export function DocumentPreview({
  companyName,
  companyAddress,
  companyTaxId,
  companyPhone,
  logoUrl,
  logoSize,
  logoPosition,
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
    companyTaxId,
    companyPhone,
    logoUrl,
    logoSize: clampLogoSize(logoSize ?? LOGO_SIZE_DEFAULT),
    logoPosition: logoPosition ?? 'left_of_company_name',
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
