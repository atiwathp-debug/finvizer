import { cn } from '@/lib/utils/cn'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
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

/**
 * A generic, self-drawn invoice/quotation mockup — not a copy of any
 * reference design — styled two different ways so the two templates read
 * as visually distinct at a glance: Executive Classic (dark, formal,
 * minimal color) vs Modern Accent (gradient header, brand-colored badges).
 */
export function DocumentTemplatePreview({ variant, density = 'compact' }: DocumentTemplatePreviewProps) {
  const isModern = variant === 'MODERN_ACCENT'
  const items = density === 'compact' ? sampleLineItems.slice(0, 2) : sampleLineItems
  const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border text-[10px] leading-tight',
        isModern ? 'border-indigo-100' : 'border-slate-200',
      )}
      aria-hidden="true"
    >
      <div
        className={cn(
          'flex items-start justify-between gap-2 px-3 py-2.5',
          isModern
            ? 'bg-gradient-to-r from-indigo-600 to-emerald-500 text-white'
            : 'bg-slate-900 text-white',
        )}
      >
        <div>
          <p className="text-[11px] font-semibold">บริษัท ตัวอย่าง จำกัด</p>
          <p className="mt-0.5 text-[9px] opacity-80">99/9 ถนนตัวอย่าง กรุงเทพมหานคร 10110</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-[11px] font-semibold',
              isModern && 'rounded-full bg-white/20 px-2 py-0.5',
            )}
          >
            ใบเสนอราคา
          </p>
          <p className="mt-0.5 text-[9px] opacity-80">เลขที่ QO-20260701-0001</p>
        </div>
      </div>

      <div className="space-y-2 bg-white px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1 text-ink-muted">
          <span>ลูกค้า: บริษัท ตัวอย่างลูกค้า จำกัด</span>
          <span>วันที่ {formatThaiDate('2026-07-01')}</span>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className={cn('text-left', isModern ? 'text-emerald-700' : 'text-slate-500')}>
              <th className="border-b border-line pb-1 font-medium">รายการ</th>
              <th className="border-b border-line pb-1 text-right font-medium">จำนวน</th>
              <th className="border-b border-line pb-1 text-right font-medium">ราคา</th>
              <th className="border-b border-line pb-1 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td className="border-b border-line/60 py-1 pr-2">{item.name}</td>
                <td className="border-b border-line/60 py-1 text-right">{item.qty}</td>
                <td className="border-b border-line/60 py-1 text-right">{formatTHB(item.unitPrice)}</td>
                <td className="border-b border-line/60 py-1 text-right">
                  {formatTHB(item.qty * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold',
              isModern ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-900',
            )}
          >
            รวมทั้งสิ้น {formatTHB(total)}
          </div>
        </div>

        {density === 'full' && (
          <div className="mt-2 flex flex-wrap justify-between gap-1 border-t border-line pt-2 text-ink-muted">
            <span>หมายเหตุ: ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม</span>
            <span>ลงชื่อผู้อนุมัติ ____________</span>
          </div>
        )}
      </div>
    </div>
  )
}
