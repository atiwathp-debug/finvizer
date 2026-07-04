import { cn } from '@/lib/utils/cn'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { getTemplatePalette } from '@/lib/templates/previewPalette'
import type { DocumentTemplateEnum } from '@/types/database'

interface DocumentTemplatePreviewProps {
  variant: DocumentTemplateEnum
  /** compact = used inside a selection card, full = used inside the full preview dialog. */
  density?: 'compact' | 'full'
}

/** Illustrative sample only — not real customer/document data. */
const sampleLineItems = [
  { name: 'ค่าบริการที่ปรึกษาระบบบัญชี', qty: 1, unitPrice: 15000 },
  { name: 'ค่าธรรมเนียมการติดตั้งระบบ', qty: 2, unitPrice: 2500 },
  { name: 'ค่าบำรุงรักษารายเดือน', qty: 3, unitPrice: 1200 },
]

const sampleSignatureLabels = ['ผู้ซื้อ', 'ผู้ขาย']

/**
 * A generic, self-drawn invoice/quotation mockup — not a copy of any
 * reference design — miniaturized to match the 3 real, structurally
 * distinct layouts in DocumentPreview.tsx/DocumentPdf.tsx (production
 * readiness pass 2 redesign):
 *  - EXECUTIVE_CLASSIC: Formal Thai business style — boxed, centered header
 *  - MODERN_ACCENT: Clean modern style — spacious, orange accent
 *  - MINIMAL_PRINT: Minimal black-line official form — no color anywhere
 */
export function DocumentTemplatePreview({ variant, density = 'compact' }: DocumentTemplatePreviewProps) {
  const { accent, accentText } = getTemplatePalette(variant)
  const items = density === 'compact' ? sampleLineItems.slice(0, 2) : sampleLineItems
  const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)

  if (variant === 'MODERN_ACCENT') {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[10px] leading-tight" aria-hidden="true">
        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-slate-900">บริษัท ตัวอย่าง จำกัด</p>
            <p className="mt-0.5 text-[9px] text-slate-500">99/9 ถนนตัวอย่าง กรุงเทพมหานคร 10110</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-light" style={{ color: accent }}>
              ใบเสนอราคา
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-slate-600">QO-20260701-0001</p>
          </div>
        </div>
        <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500">
            <span>ลูกค้า: บริษัท ตัวอย่างลูกค้า จำกัด</span>
            <span>วันที่ {formatThaiDate('2026-07-01')}</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left uppercase tracking-wide text-slate-400" style={{ borderBottom: `1.5px solid ${accent}` }}>
                <th className="pb-1 font-medium">รายการ</th>
                <th className="pb-1 text-right font-medium">จำนวน</th>
                <th className="pb-1 text-right font-medium">ราคา</th>
                <th className="pb-1 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name} className="border-b border-slate-50">
                  <td className="py-1 pr-2 text-slate-700">{item.name}</td>
                  <td className="py-1 text-right text-slate-700">{item.qty}</td>
                  <td className="py-1 text-right text-slate-700">{formatTHB(item.unitPrice)}</td>
                  <td className="py-1 text-right text-slate-700">{formatTHB(item.qty * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <div className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: accent, color: accentText }}>
              รวมทั้งสิ้น {formatTHB(total)}
            </div>
          </div>
          {density === 'full' && (
            <div className="mt-2 flex flex-wrap justify-between gap-3 pt-2">
              {sampleSignatureLabels.map((label) => (
                <div key={label} className="text-center">
                  <div className="h-px w-16" style={{ backgroundColor: accent }} />
                  <p className="mt-1 text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'MINIMAL_PRINT') {
    return (
      <div className="overflow-hidden border border-black bg-white text-[10px] leading-tight text-black" aria-hidden="true">
        <div className="flex items-start justify-between gap-2 border-b border-black px-3 py-2.5">
          <div>
            <p className="text-[11px] font-bold">บริษัท ตัวอย่าง จำกัด</p>
            <p className="mt-0.5 text-[9px]">99/9 ถนนตัวอย่าง กรุงเทพมหานคร 10110</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold">ใบเสนอราคา</p>
            <p className="mt-0.5 text-[9px]">QO-20260701-0001</p>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
          <div className="p-2">
            <p>ลูกค้า</p>
            <p className="font-medium">บริษัท ตัวอย่างลูกค้า จำกัด</p>
          </div>
          <div className="p-2">
            <div className="flex justify-between">
              <span>วันที่</span>
              <span>{formatThaiDate('2026-07-01')}</span>
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className="border border-black p-1 font-medium">รายการ</th>
                <th className="border border-black p-1 text-right font-medium">จำนวน</th>
                <th className="border border-black p-1 text-right font-medium">ราคา</th>
                <th className="border border-black p-1 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name}>
                  <td className="border border-black p-1">{item.name}</td>
                  <td className="border border-black p-1 text-right">{item.qty}</td>
                  <td className="border border-black p-1 text-right">{formatTHB(item.unitPrice)}</td>
                  <td className="border border-black p-1 text-right">{formatTHB(item.qty * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end border-t border-black pt-1 font-bold">
            รวมทั้งสิ้น {formatTHB(total)}
          </div>
          {density === 'full' && (
            <div className="mt-3 flex flex-wrap justify-between gap-3">
              {sampleSignatureLabels.map((label) => (
                <div key={label} className="text-center">
                  <div className="h-6 w-16 border-b border-black" />
                  <p className="mt-1">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // EXECUTIVE_CLASSIC — Formal Thai business style — boxed, centered header.
  return (
    <div className={cn('overflow-hidden rounded-lg border-2 border-slate-800 bg-white text-[10px] leading-tight')} aria-hidden="true">
      <div className="border-b-2 border-slate-800 px-3 py-2.5">
        <p className="text-center text-[11px] font-bold text-slate-900">บริษัท ตัวอย่าง จำกัด</p>
        <p className="text-center text-[9px] text-slate-500">99/9 ถนนตัวอย่าง กรุงเทพมหานคร 10110</p>
        <div className="mt-1.5 flex justify-center">
          <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: accent, color: accentText }}>
            ใบเสนอราคา
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x-2 divide-slate-800 border-b-2 border-slate-800">
        <div className="p-2">
          <p className="text-slate-500">ลูกค้า</p>
          <p className="font-medium text-slate-900">บริษัท ตัวอย่างลูกค้า จำกัด</p>
        </div>
        <div className="p-2">
          <div className="flex justify-between">
            <span className="text-slate-500">เลขที่</span>
            <span className="text-slate-900">QO-20260701-0001</span>
          </div>
        </div>
      </div>
      <div className="space-y-2 bg-white px-3 py-2.5">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="border border-slate-800 p-1 font-medium">รายการ</th>
              <th className="border border-slate-800 p-1 text-right font-medium">จำนวน</th>
              <th className="border border-slate-800 p-1 text-right font-medium">ราคา</th>
              <th className="border border-slate-800 p-1 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td className="border border-slate-800 p-1">{item.name}</td>
                <td className="border border-slate-800 p-1 text-right">{item.qty}</td>
                <td className="border border-slate-800 p-1 text-right">{formatTHB(item.unitPrice)}</td>
                <td className="border border-slate-800 p-1 text-right">{formatTHB(item.qty * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end">
          <div
            className="rounded border-2 px-2 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: accent, color: accentText, borderColor: accent }}
          >
            รวมทั้งสิ้น {formatTHB(total)}
          </div>
        </div>
        {density === 'full' && (
          <div className="mt-2 flex flex-wrap justify-between gap-2 border-t-2 border-slate-800 pt-2">
            {sampleSignatureLabels.map((label) => (
              <div key={label} className="flex-1 border border-slate-800 p-1.5 text-center">
                <div className="h-4" />
                <p className="border-t border-slate-800 pt-0.5 text-slate-700">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
