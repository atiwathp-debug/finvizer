import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { THAI_FONT_FAMILY, registerPdfFonts } from '@/lib/pdf/fonts'
import { sanitizeText } from '@/lib/pdf/sanitizeText'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { getTemplatePalette } from '@/lib/templates/previewPalette'
import { documentTypeLabels, type DocumentRecord } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'
import type { DocumentTemplateEnum } from '@/types/database'
import type { SignatureSlot } from '@/types/signature'
import type { DocumentInstallment } from '@/types/documentInstallment'

registerPdfFonts()

// Shared by all 3 template layouts below — the outer <Page>/font setup is
// identical either way; each layout supplies its own header/table/totals/
// signature styling on top of this.
const baseStyles = StyleSheet.create({
  page: {
    padding: 32,
    // Falls back to the PDF standard "Helvetica" font (always available,
    // no embedding needed) for any glyph the Thai-subset font doesn't
    // cover — react-pdf resolves this per-glyph, not per-string, so mixed
    // Thai/Latin/number text on the same line renders correctly either way.
    fontFamily: [THAI_FONT_FAMILY, 'Helvetica'],
    fontSize: 9,
    color: '#0f172a',
  },
})

interface TemplateContentProps {
  company: Company
  customer: Customer | null
  document: DocumentRecord
  signatureSlots: SignatureSlot[]
  installments: DocumentInstallment[]
  accent: string
  accentText: string
}

/**
 * Template 1 — Formal Thai business style (boxed, official). A heavy
 * outer border, a centered company/document header, bordered customer/
 * metadata boxes, a strong-grid item table, a boxed grand-total, and
 * bordered signature boxes — mirrors FormalTemplate in DocumentPreview.tsx.
 */
const formalStyles = StyleSheet.create({
  outer: { borderWidth: 2, borderColor: '#1e293b' },
  headerBlock: { borderBottomWidth: 2, borderBottomColor: '#1e293b', padding: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoSlot: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 50, height: 50, objectFit: 'contain' },
  companyBlock: { flex: 1, alignItems: 'center' },
  companyName: { fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'center' },
  companyLine: { fontSize: 8, marginTop: 2, color: '#334155', textAlign: 'center' },
  docTypeBadgeWrap: { marginTop: 8, alignItems: 'center' },
  docTypeBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 2 },
  docTypeBadgeText: { fontSize: 11, fontWeight: 700 },
  metaRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#1e293b' },
  metaCol: { flex: 1, padding: 10 },
  metaColBorder: { borderRightWidth: 2, borderRightColor: '#1e293b' },
  metaLabel: { fontSize: 7.5, color: '#64748b', marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 700, color: '#0f172a' },
  metaLine: { fontSize: 8, marginTop: 1, color: '#334155' },
  metaKV: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  body: { padding: 12 },
  table: { borderWidth: 1, borderColor: '#1e293b' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f1f5f9' },
  tableRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, borderColor: '#1e293b', padding: 5, fontSize: 8.5 },
  colDescription: { width: '46%' },
  colQuantity: { width: '16%', textAlign: 'right' },
  colUnitPrice: { width: '19%', textAlign: 'right' },
  colAmount: { width: '19%', textAlign: 'right' },
  headerCellText: { fontSize: 8, fontWeight: 700, color: '#334155' },
  installmentSection: { marginTop: 10 },
  installmentLabel: { fontSize: 8, fontWeight: 700, color: '#475569', marginBottom: 4 },
  colInstallmentNo: { width: '10%' },
  colInstallmentNote: { width: '40%' },
  colInstallmentDueDate: { width: '25%' },
  colInstallmentAmount: { width: '25%', textAlign: 'right' },
  totalsWrap: { alignItems: 'flex-end', marginTop: 10 },
  totalsBox: { width: 220, borderWidth: 2, borderColor: '#1e293b' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1e293b', padding: 6 },
  totalsLabel: { fontSize: 8.5, color: '#475569' },
  totalsValue: { fontSize: 8.5, color: '#0f172a' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  grandTotalLabel: { fontSize: 10, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  noteSection: { borderTopWidth: 2, borderTopColor: '#1e293b', padding: 10 },
  noteText: { fontSize: 8.5, color: '#334155' },
  signatureSection: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 2, borderTopColor: '#1e293b', padding: 10, gap: 10 },
  signatureBox: { flexGrow: 1, minWidth: 130, borderWidth: 1, borderColor: '#1e293b', padding: 8, alignItems: 'center' },
  signatureBoxLine: { height: 30 },
  signatureLabel: { fontSize: 8, color: '#334155', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 4, width: '100%' },
  signatureDate: { fontSize: 7, color: '#64748b', textAlign: 'center', marginTop: 6 },
})

function FormalTemplateContent({ company, customer, document: doc, signatureSlots, installments, accent, accentText }: TemplateContentProps) {
  return (
    <View style={formalStyles.outer}>
      <View style={formalStyles.headerBlock}>
        <View style={formalStyles.headerRow}>
          <View style={formalStyles.logoSlot}>
            {company.logoUrl && <Image src={company.logoUrl} style={formalStyles.logo} />}
          </View>
          <View style={formalStyles.companyBlock}>
            <Text style={formalStyles.companyName}>{sanitizeText(company.nameTh)}</Text>
            {company.address && <Text style={formalStyles.companyLine}>{sanitizeText(company.address)}</Text>}
            <Text style={formalStyles.companyLine}>
              เลขประจำตัวผู้เสียภาษี {sanitizeText(company.taxId)}
              {company.phone ? ` · โทร ${sanitizeText(company.phone)}` : ''}
            </Text>
          </View>
          <View style={formalStyles.logoSlot} />
        </View>
        <View style={formalStyles.docTypeBadgeWrap}>
          <View style={[formalStyles.docTypeBadge, { backgroundColor: accent }]}>
            <Text style={[formalStyles.docTypeBadgeText, { color: accentText }]}>{documentTypeLabels[doc.documentType]}</Text>
          </View>
        </View>
      </View>

      <View style={formalStyles.metaRow}>
        <View style={[formalStyles.metaCol, formalStyles.metaColBorder]}>
          <Text style={formalStyles.metaLabel}>ลูกค้า</Text>
          <Text style={formalStyles.metaValue}>{customer ? sanitizeText(customer.name) : '-'}</Text>
          {customer?.address && <Text style={formalStyles.metaLine}>{sanitizeText(customer.address)}</Text>}
          {customer?.taxId && <Text style={formalStyles.metaLine}>เลขประจำตัวผู้เสียภาษี {sanitizeText(customer.taxId)}</Text>}
        </View>
        <View style={formalStyles.metaCol}>
          <View style={formalStyles.metaKV}>
            <Text style={formalStyles.metaLabel}>เลขที่เอกสาร</Text>
            <Text style={formalStyles.metaValue}>{doc.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}</Text>
          </View>
          <View style={formalStyles.metaKV}>
            <Text style={formalStyles.metaLabel}>วันที่ออกเอกสาร</Text>
            <Text style={formalStyles.metaLine}>{doc.issueDate ? formatThaiDate(doc.issueDate) : '-'}</Text>
          </View>
          {doc.dueDate && (
            <View style={formalStyles.metaKV}>
              <Text style={formalStyles.metaLabel}>ครบกำหนด</Text>
              <Text style={formalStyles.metaLine}>{formatThaiDate(doc.dueDate)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={formalStyles.body}>
        <View style={formalStyles.table}>
          <View style={formalStyles.tableHeaderRow}>
            <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colDescription]}>รายการ</Text>
            <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colQuantity]}>จำนวน</Text>
            <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colUnitPrice]}>ราคา/หน่วย</Text>
            <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colAmount]}>จำนวนเงิน</Text>
          </View>
          {doc.items.length === 0 ? (
            <View style={formalStyles.tableRow}>
              <Text style={[formalStyles.cell, { width: '100%', color: '#94a3b8' }]}>ยังไม่มีรายการ</Text>
            </View>
          ) : (
            doc.items.map((item) => (
              <View key={item.id} style={formalStyles.tableRow}>
                <Text style={[formalStyles.cell, formalStyles.colDescription]}>{sanitizeText(item.description)}</Text>
                <Text style={[formalStyles.cell, formalStyles.colQuantity]}>
                  {item.quantity} {sanitizeText(item.unit ?? '')}
                </Text>
                <Text style={[formalStyles.cell, formalStyles.colUnitPrice]}>{formatTHB(item.unitPrice)}</Text>
                <Text style={[formalStyles.cell, formalStyles.colAmount]}>{formatTHB(item.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {installments.length > 0 && (
          <View style={formalStyles.installmentSection}>
            <Text style={formalStyles.installmentLabel}>เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</Text>
            <View style={formalStyles.table}>
              <View style={formalStyles.tableHeaderRow}>
                <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colInstallmentNo]}>งวดที่</Text>
                <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colInstallmentNote]}>รายละเอียด</Text>
                <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colInstallmentDueDate]}>ครบกำหนด</Text>
                <Text style={[formalStyles.cell, formalStyles.headerCellText, formalStyles.colInstallmentAmount]}>จำนวนเงิน</Text>
              </View>
              {installments.map((installment) => (
                <View key={installment.id} style={formalStyles.tableRow}>
                  <Text style={[formalStyles.cell, formalStyles.colInstallmentNo]}>{installment.installmentNo}</Text>
                  <Text style={[formalStyles.cell, formalStyles.colInstallmentNote]}>
                    {installment.note ? sanitizeText(installment.note) : '-'}
                  </Text>
                  <Text style={[formalStyles.cell, formalStyles.colInstallmentDueDate]}>
                    {installment.dueDate ? formatThaiDate(installment.dueDate) : '-'}
                  </Text>
                  <Text style={[formalStyles.cell, formalStyles.colInstallmentAmount]}>{formatTHB(installment.computedAmount)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={formalStyles.totalsWrap}>
          <View style={formalStyles.totalsBox}>
            <View style={formalStyles.totalsRow}>
              <Text style={formalStyles.totalsLabel}>รวมเป็นเงิน</Text>
              <Text style={formalStyles.totalsValue}>{formatTHB(doc.subtotal)}</Text>
            </View>
            {doc.discountTotal > 0 && (
              <View style={formalStyles.totalsRow}>
                <Text style={formalStyles.totalsLabel}>ส่วนลด</Text>
                <Text style={formalStyles.totalsValue}>-{formatTHB(doc.discountTotal)}</Text>
              </View>
            )}
            {doc.vatMode !== 'NON_VAT' && (
              <View style={formalStyles.totalsRow}>
                <Text style={formalStyles.totalsLabel}>
                  {doc.vatMode === 'VAT_INCLUDED' ? 'ภาษีมูลค่าเพิ่ม (รวมในราคาแล้ว)' : 'ภาษีมูลค่าเพิ่ม 7%'}
                </Text>
                <Text style={formalStyles.totalsValue}>{formatTHB(doc.vatAmount)}</Text>
              </View>
            )}
            <View style={[formalStyles.grandTotalRow, { backgroundColor: accent }]}>
              <Text style={[formalStyles.grandTotalLabel, { color: accentText }]}>ยอดรวมทั้งสิ้น</Text>
              <Text style={[formalStyles.grandTotalValue, { color: accentText }]}>{formatTHB(doc.grandTotal)}</Text>
            </View>
          </View>
        </View>
      </View>

      {doc.note && (
        <View style={formalStyles.noteSection}>
          <Text style={formalStyles.noteText}>หมายเหตุ: {sanitizeText(doc.note)}</Text>
        </View>
      )}

      <View style={formalStyles.signatureSection}>
        {signatureSlots.map((slot) => (
          <View key={slot.id} style={formalStyles.signatureBox}>
            <View style={formalStyles.signatureBoxLine} />
            <Text style={formalStyles.signatureLabel}>{sanitizeText(slot.label)}</Text>
            <Text style={formalStyles.signatureDate}>วันที่ ____________</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Template 2 — Clean modern style. Spacious, mostly white, no borders
 * boxing anything in; logo/company info top-left, document title and
 * metadata top-right, a single warm accent color marking the title and
 * grand-total pill — mirrors ModernTemplate in DocumentPreview.tsx.
 */
const modernStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logo: { width: 40, height: 40, objectFit: 'contain' },
  companyName: { fontSize: 12, fontWeight: 700, color: '#0f172a' },
  companyLine: { fontSize: 8, marginTop: 2, color: '#64748b' },
  docType: { fontSize: 20, fontWeight: 300, textAlign: 'right' },
  docNumber: { fontSize: 9, fontWeight: 700, marginTop: 3, textAlign: 'right', color: '#334155' },
  docNumberPlaceholder: { fontSize: 8, fontStyle: 'italic', marginTop: 3, textAlign: 'right', color: '#94a3b8' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  metaBlock: { maxWidth: '55%' },
  metaLabel: { fontSize: 7, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 700, color: '#0f172a' },
  metaLine: { fontSize: 8.5, marginTop: 1, color: '#334155' },
  table: { marginTop: 20 },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', paddingVertical: 5 },
  colDescription: { width: '46%' },
  colQuantity: { width: '16%', textAlign: 'right' },
  colUnitPrice: { width: '19%', textAlign: 'right' },
  colAmount: { width: '19%', textAlign: 'right' },
  headerCellText: { fontSize: 7, textTransform: 'uppercase', color: '#94a3b8' },
  cellText: { fontSize: 8.5, color: '#1e293b' },
  installmentSection: { marginTop: 16 },
  installmentLabel: { fontSize: 7, textTransform: 'uppercase', marginBottom: 4 },
  colInstallmentNo: { width: '10%' },
  colInstallmentNote: { width: '40%' },
  colInstallmentDueDate: { width: '25%' },
  colInstallmentAmount: { width: '25%', textAlign: 'right' },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', width: 220, marginTop: 4 },
  totalsLabel: { fontSize: 8.5, color: '#64748b' },
  totalsValue: { fontSize: 8.5, color: '#1e293b' },
  grandTotalPill: { flexDirection: 'row', justifyContent: 'space-between', width: 220, marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  grandTotalLabel: { fontSize: 10, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  noteSection: { marginTop: 20 },
  noteText: { fontSize: 8.5, color: '#64748b' },
  signatureSection: { marginTop: 48, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24 },
  signatureBox: { width: '30%', minWidth: 140 },
  signatureLine: { height: 1 },
  signatureLabel: { fontSize: 8, color: '#475569', textAlign: 'center', marginTop: 8 },
})

function ModernTemplateContent({ company, customer, document: doc, signatureSlots, installments, accent, accentText }: TemplateContentProps) {
  return (
    <View>
      <View style={modernStyles.headerRow}>
        <View style={modernStyles.headerLeft}>
          {company.logoUrl && <Image src={company.logoUrl} style={modernStyles.logo} />}
          <View>
            <Text style={modernStyles.companyName}>{sanitizeText(company.nameTh)}</Text>
            {company.address && <Text style={modernStyles.companyLine}>{sanitizeText(company.address)}</Text>}
            <Text style={modernStyles.companyLine}>
              เลขประจำตัวผู้เสียภาษี {sanitizeText(company.taxId)}
              {company.phone ? ` · โทร ${sanitizeText(company.phone)}` : ''}
            </Text>
          </View>
        </View>
        <View>
          <Text style={[modernStyles.docType, { color: accent }]}>{documentTypeLabels[doc.documentType]}</Text>
          {doc.documentNumber ? (
            <Text style={modernStyles.docNumber}>{doc.documentNumber}</Text>
          ) : (
            <Text style={modernStyles.docNumberPlaceholder}>จะออกเลขเมื่ออนุมัติ</Text>
          )}
        </View>
      </View>

      <View style={modernStyles.metaRow}>
        <View style={modernStyles.metaBlock}>
          <Text style={modernStyles.metaLabel}>ลูกค้า</Text>
          <Text style={modernStyles.metaValue}>{customer ? sanitizeText(customer.name) : '-'}</Text>
          {customer?.address && <Text style={modernStyles.metaLine}>{sanitizeText(customer.address)}</Text>}
          {customer?.contactName && <Text style={modernStyles.metaLine}>ผู้ติดต่อ {sanitizeText(customer.contactName)}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={modernStyles.metaLabel}>วันที่ออกเอกสาร</Text>
          <Text style={modernStyles.metaLine}>{doc.issueDate ? formatThaiDate(doc.issueDate) : '-'}</Text>
          {doc.dueDate && (
            <>
              <Text style={[modernStyles.metaLabel, { marginTop: 6 }]}>ครบกำหนด</Text>
              <Text style={modernStyles.metaLine}>{formatThaiDate(doc.dueDate)}</Text>
            </>
          )}
        </View>
      </View>

      <View style={modernStyles.table}>
        <View style={[modernStyles.tableHeaderRow, { borderBottomWidth: 2, borderBottomColor: accent }]}>
          <Text style={[modernStyles.headerCellText, modernStyles.colDescription]}>รายการ</Text>
          <Text style={[modernStyles.headerCellText, modernStyles.colQuantity]}>จำนวน</Text>
          <Text style={[modernStyles.headerCellText, modernStyles.colUnitPrice]}>ราคา/หน่วย</Text>
          <Text style={[modernStyles.headerCellText, modernStyles.colAmount]}>จำนวนเงิน</Text>
        </View>
        {doc.items.length === 0 ? (
          <View style={modernStyles.tableRow}>
            <Text style={{ fontSize: 8.5, color: '#94a3b8' }}>ยังไม่มีรายการ</Text>
          </View>
        ) : (
          doc.items.map((item) => (
            <View key={item.id} style={modernStyles.tableRow}>
              <Text style={[modernStyles.cellText, modernStyles.colDescription]}>{sanitizeText(item.description)}</Text>
              <Text style={[modernStyles.cellText, modernStyles.colQuantity]}>
                {item.quantity} {sanitizeText(item.unit ?? '')}
              </Text>
              <Text style={[modernStyles.cellText, modernStyles.colUnitPrice]}>{formatTHB(item.unitPrice)}</Text>
              <Text style={[modernStyles.cellText, modernStyles.colAmount]}>{formatTHB(item.amount)}</Text>
            </View>
          ))
        )}
      </View>

      {installments.length > 0 && (
        <View style={modernStyles.installmentSection}>
          <Text style={[modernStyles.installmentLabel, { color: accent }]}>เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</Text>
          <View style={[modernStyles.tableHeaderRow, { borderBottomWidth: 2, borderBottomColor: accent }]}>
            <Text style={[modernStyles.headerCellText, modernStyles.colInstallmentNo]}>งวดที่</Text>
            <Text style={[modernStyles.headerCellText, modernStyles.colInstallmentNote]}>รายละเอียด</Text>
            <Text style={[modernStyles.headerCellText, modernStyles.colInstallmentDueDate]}>ครบกำหนด</Text>
            <Text style={[modernStyles.headerCellText, modernStyles.colInstallmentAmount]}>จำนวนเงิน</Text>
          </View>
          {installments.map((installment) => (
            <View key={installment.id} style={modernStyles.tableRow}>
              <Text style={[modernStyles.cellText, modernStyles.colInstallmentNo]}>{installment.installmentNo}</Text>
              <Text style={[modernStyles.cellText, modernStyles.colInstallmentNote]}>
                {installment.note ? sanitizeText(installment.note) : '-'}
              </Text>
              <Text style={[modernStyles.cellText, modernStyles.colInstallmentDueDate]}>
                {installment.dueDate ? formatThaiDate(installment.dueDate) : '-'}
              </Text>
              <Text style={[modernStyles.cellText, modernStyles.colInstallmentAmount]}>{formatTHB(installment.computedAmount)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={modernStyles.totalsSection}>
        <View style={modernStyles.totalsRow}>
          <Text style={modernStyles.totalsLabel}>รวมเป็นเงิน</Text>
          <Text style={modernStyles.totalsValue}>{formatTHB(doc.subtotal)}</Text>
        </View>
        {doc.discountTotal > 0 && (
          <View style={modernStyles.totalsRow}>
            <Text style={modernStyles.totalsLabel}>ส่วนลด</Text>
            <Text style={modernStyles.totalsValue}>-{formatTHB(doc.discountTotal)}</Text>
          </View>
        )}
        {doc.vatMode !== 'NON_VAT' && (
          <View style={modernStyles.totalsRow}>
            <Text style={modernStyles.totalsLabel}>
              {doc.vatMode === 'VAT_INCLUDED' ? 'ภาษีมูลค่าเพิ่ม (รวมในราคาแล้ว)' : 'ภาษีมูลค่าเพิ่ม 7%'}
            </Text>
            <Text style={modernStyles.totalsValue}>{formatTHB(doc.vatAmount)}</Text>
          </View>
        )}
        <View style={[modernStyles.grandTotalPill, { backgroundColor: accent }]}>
          <Text style={[modernStyles.grandTotalLabel, { color: accentText }]}>ยอดรวมทั้งสิ้น</Text>
          <Text style={[modernStyles.grandTotalValue, { color: accentText }]}>{formatTHB(doc.grandTotal)}</Text>
        </View>
      </View>

      {doc.note && (
        <View style={modernStyles.noteSection}>
          <Text style={modernStyles.noteText}>หมายเหตุ: {sanitizeText(doc.note)}</Text>
        </View>
      )}

      <View style={modernStyles.signatureSection}>
        {signatureSlots.map((slot) => (
          <View key={slot.id} style={modernStyles.signatureBox}>
            <View style={[modernStyles.signatureLine, { backgroundColor: accent }]} />
            <Text style={modernStyles.signatureLabel}>{sanitizeText(slot.label)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Template 3 — Minimal black-line official form. Deliberately the
 * plainest of the three: a single thin black border around the whole
 * document, plain black text throughout, boxed customer/document-info
 * like a government form, a simple item grid, and signature lines (not
 * boxes) at the bottom — mirrors MinimalTemplate in DocumentPreview.tsx.
 */
const minimalStyles = StyleSheet.create({
  outer: { borderWidth: 1, borderColor: '#000000', padding: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  companyName: { fontSize: 11, fontWeight: 700, color: '#000000' },
  companyLine: { fontSize: 8, marginTop: 2, color: '#000000' },
  docType: { fontSize: 11, fontWeight: 700, color: '#000000', textAlign: 'right' },
  docNumber: { fontSize: 8, marginTop: 2, color: '#000000', textAlign: 'right' },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000000' },
  metaCol: { flex: 1, padding: 6 },
  metaColBorder: { borderRightWidth: 1, borderRightColor: '#000000' },
  metaLabel: { fontSize: 7.5, color: '#000000' },
  metaValue: { fontSize: 9, fontWeight: 700, color: '#000000', marginTop: 1 },
  metaKV: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  table: { marginTop: 8, borderWidth: 1, borderColor: '#000000' },
  tableHeaderRow: { flexDirection: 'row' },
  tableRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, borderColor: '#000000', padding: 4, fontSize: 8.5, color: '#000000' },
  colDescription: { width: '46%' },
  colQuantity: { width: '16%', textAlign: 'right' },
  colUnitPrice: { width: '19%', textAlign: 'right' },
  colAmount: { width: '19%', textAlign: 'right' },
  headerCellText: { fontSize: 8, fontWeight: 700 },
  installmentSection: { marginTop: 8 },
  installmentLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3, color: '#000000' },
  colInstallmentNo: { width: '10%' },
  colInstallmentNote: { width: '40%' },
  colInstallmentDueDate: { width: '25%' },
  colInstallmentAmount: { width: '25%', textAlign: 'right' },
  totalsWrap: { alignItems: 'flex-end', marginTop: 8, borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 6 },
  totalsBox: { width: 200 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  totalsLabel: { fontSize: 8.5, color: '#000000' },
  totalsValue: { fontSize: 8.5, color: '#000000' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 3, borderTopWidth: 1, borderTopColor: '#000000' },
  grandTotalLabel: { fontSize: 9.5, fontWeight: 700, color: '#000000' },
  grandTotalValue: { fontSize: 9.5, fontWeight: 700, color: '#000000' },
  noteSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 6 },
  noteText: { fontSize: 8.5, color: '#000000' },
  signatureSection: { marginTop: 32, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  signatureBox: { width: '30%', minWidth: 130 },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#000000', marginTop: 28 },
  signatureLabel: { fontSize: 8, color: '#000000', textAlign: 'center', marginTop: 3 },
})

function MinimalTemplateContent({ company, customer, document: doc, signatureSlots, installments }: TemplateContentProps) {
  return (
    <View style={minimalStyles.outer}>
      <View style={minimalStyles.headerRow}>
        <View style={minimalStyles.headerLeft}>
          {company.logoUrl && <Image src={company.logoUrl} style={minimalStyles.logo} />}
          <View>
            <Text style={minimalStyles.companyName}>{sanitizeText(company.nameTh)}</Text>
            {company.address && <Text style={minimalStyles.companyLine}>{sanitizeText(company.address)}</Text>}
          </View>
        </View>
        <View>
          <Text style={minimalStyles.docType}>{documentTypeLabels[doc.documentType]}</Text>
          <Text style={minimalStyles.docNumber}>{doc.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}</Text>
        </View>
      </View>

      <View style={minimalStyles.metaRow}>
        <View style={[minimalStyles.metaCol, minimalStyles.metaColBorder]}>
          <Text style={minimalStyles.metaLabel}>ลูกค้า</Text>
          <Text style={minimalStyles.metaValue}>{customer ? sanitizeText(customer.name) : '-'}</Text>
          {customer?.address && <Text style={minimalStyles.companyLine}>{sanitizeText(customer.address)}</Text>}
        </View>
        <View style={minimalStyles.metaCol}>
          <View style={minimalStyles.metaKV}>
            <Text style={minimalStyles.metaLabel}>วันที่ออกเอกสาร</Text>
            <Text style={minimalStyles.metaLabel}>{doc.issueDate ? formatThaiDate(doc.issueDate) : '-'}</Text>
          </View>
          {doc.dueDate && (
            <View style={minimalStyles.metaKV}>
              <Text style={minimalStyles.metaLabel}>ครบกำหนด</Text>
              <Text style={minimalStyles.metaLabel}>{formatThaiDate(doc.dueDate)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={minimalStyles.table}>
        <View style={minimalStyles.tableHeaderRow}>
          <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colDescription]}>รายการ</Text>
          <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colQuantity]}>จำนวน</Text>
          <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colUnitPrice]}>ราคา/หน่วย</Text>
          <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colAmount]}>จำนวนเงิน</Text>
        </View>
        {doc.items.length === 0 ? (
          <View style={minimalStyles.tableRow}>
            <Text style={[minimalStyles.cell, { width: '100%' }]}>ยังไม่มีรายการ</Text>
          </View>
        ) : (
          doc.items.map((item) => (
            <View key={item.id} style={minimalStyles.tableRow}>
              <Text style={[minimalStyles.cell, minimalStyles.colDescription]}>{sanitizeText(item.description)}</Text>
              <Text style={[minimalStyles.cell, minimalStyles.colQuantity]}>
                {item.quantity} {sanitizeText(item.unit ?? '')}
              </Text>
              <Text style={[minimalStyles.cell, minimalStyles.colUnitPrice]}>{formatTHB(item.unitPrice)}</Text>
              <Text style={[minimalStyles.cell, minimalStyles.colAmount]}>{formatTHB(item.amount)}</Text>
            </View>
          ))
        )}
      </View>

      {installments.length > 0 && (
        <View style={minimalStyles.installmentSection}>
          <Text style={minimalStyles.installmentLabel}>เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</Text>
          <View style={minimalStyles.table}>
            <View style={minimalStyles.tableHeaderRow}>
              <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colInstallmentNo]}>งวดที่</Text>
              <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colInstallmentNote]}>รายละเอียด</Text>
              <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colInstallmentDueDate]}>ครบกำหนด</Text>
              <Text style={[minimalStyles.cell, minimalStyles.headerCellText, minimalStyles.colInstallmentAmount]}>จำนวนเงิน</Text>
            </View>
            {installments.map((installment) => (
              <View key={installment.id} style={minimalStyles.tableRow}>
                <Text style={[minimalStyles.cell, minimalStyles.colInstallmentNo]}>{installment.installmentNo}</Text>
                <Text style={[minimalStyles.cell, minimalStyles.colInstallmentNote]}>
                  {installment.note ? sanitizeText(installment.note) : '-'}
                </Text>
                <Text style={[minimalStyles.cell, minimalStyles.colInstallmentDueDate]}>
                  {installment.dueDate ? formatThaiDate(installment.dueDate) : '-'}
                </Text>
                <Text style={[minimalStyles.cell, minimalStyles.colInstallmentAmount]}>{formatTHB(installment.computedAmount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={minimalStyles.totalsWrap}>
        <View style={minimalStyles.totalsBox}>
          <View style={minimalStyles.totalsRow}>
            <Text style={minimalStyles.totalsLabel}>รวมเป็นเงิน</Text>
            <Text style={minimalStyles.totalsValue}>{formatTHB(doc.subtotal)}</Text>
          </View>
          {doc.discountTotal > 0 && (
            <View style={minimalStyles.totalsRow}>
              <Text style={minimalStyles.totalsLabel}>ส่วนลด</Text>
              <Text style={minimalStyles.totalsValue}>-{formatTHB(doc.discountTotal)}</Text>
            </View>
          )}
          {doc.vatMode !== 'NON_VAT' && (
            <View style={minimalStyles.totalsRow}>
              <Text style={minimalStyles.totalsLabel}>
                {doc.vatMode === 'VAT_INCLUDED' ? 'ภาษีมูลค่าเพิ่ม (รวมในราคาแล้ว)' : 'ภาษีมูลค่าเพิ่ม 7%'}
              </Text>
              <Text style={minimalStyles.totalsValue}>{formatTHB(doc.vatAmount)}</Text>
            </View>
          )}
          <View style={minimalStyles.grandTotalRow}>
            <Text style={minimalStyles.grandTotalLabel}>ยอดรวมทั้งสิ้น</Text>
            <Text style={minimalStyles.grandTotalValue}>{formatTHB(doc.grandTotal)}</Text>
          </View>
        </View>
      </View>

      {doc.note && (
        <View style={minimalStyles.noteSection}>
          <Text style={minimalStyles.noteText}>หมายเหตุ: {sanitizeText(doc.note)}</Text>
        </View>
      )}

      <View style={minimalStyles.signatureSection}>
        {signatureSlots.map((slot) => (
          <View key={slot.id} style={minimalStyles.signatureBox}>
            <View style={minimalStyles.signatureLine} />
            <Text style={minimalStyles.signatureLabel}>{sanitizeText(slot.label)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

interface DocumentPdfProps {
  company: Company
  customer: Customer | null
  document: DocumentRecord
  template: DocumentTemplateEnum
  /** Company's configured signature slots, already fallback-wrapped by the caller (see generateDocumentPdf.tsx). */
  signatureSlots: SignatureSlot[]
  /** This document's installment payment plan, if any — renders an extra table when non-empty. */
  installments: DocumentInstallment[]
}

/**
 * Renders one of 3 structurally distinct layouts (production readiness
 * pass 2 redesign) — not just a color swap on one shared layout — see
 * FormalTemplateContent/ModernTemplateContent/MinimalTemplateContent
 * above, mirrored exactly in src/features/documents/DocumentPreview.tsx
 * for the on-screen preview.
 */
export function DocumentPdf({ company, customer, document: doc, template, signatureSlots, installments }: DocumentPdfProps) {
  const { accent, accentText } = getTemplatePalette(template)
  const contentProps: TemplateContentProps = { company, customer, document: doc, signatureSlots, installments, accent, accentText }

  return (
    <Document title={`${documentTypeLabels[doc.documentType]}-${doc.documentNumber ?? 'DRAFT'}`}>
      <Page size="A4" style={baseStyles.page}>
        {template === 'MODERN_ACCENT' && <ModernTemplateContent {...contentProps} />}
        {template === 'MINIMAL_PRINT' && <MinimalTemplateContent {...contentProps} />}
        {template !== 'MODERN_ACCENT' && template !== 'MINIMAL_PRINT' && <FormalTemplateContent {...contentProps} />}
      </Page>
    </Document>
  )
}
