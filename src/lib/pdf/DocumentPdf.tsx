import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { THAI_FONT_FAMILY, registerPdfFonts } from '@/lib/pdf/fonts'
import { sanitizeText } from '@/lib/pdf/sanitizeText'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { documentStatusLabels, documentTypeLabels, revisionLabel, type DocumentRecord } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'
import type { DocumentTemplateEnum } from '@/types/database'

registerPdfFonts()

/**
 * Colors mirror src/components/templates/DocumentTemplatePreview.tsx's two
 * on-screen mockups exactly, so the exported PDF reads as the same
 * template the user picked in Settings > Templates — Executive Classic
 * (dark slate header, minimal color) vs Modern Accent (indigo header,
 * emerald accents). react-pdf has no CSS gradient support, so Modern
 * Accent's header uses a solid indigo fill instead of the on-screen
 * gradient — same brand-forward feel, simpler to render reliably.
 */
const palette = {
  EXECUTIVE_CLASSIC: { header: '#0f172a', headerText: '#ffffff', accent: '#334155', totalBg: '#f1f5f9' },
  MODERN_ACCENT: { header: '#4f46e5', headerText: '#ffffff', accent: '#059669', totalBg: '#ecfdf5' },
} as const

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 4,
  },
  headerCompanyName: { fontSize: 13, fontWeight: 700 },
  headerLine: { fontSize: 8, marginTop: 2, opacity: 0.85 },
  headerDocType: { fontSize: 13, fontWeight: 700, textAlign: 'right' },
  headerDocNumber: { fontSize: 9, marginTop: 2, textAlign: 'right' },
  headerRevision: { fontSize: 8, marginTop: 2, textAlign: 'right', opacity: 0.85 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  infoBlock: { maxWidth: '55%' },
  infoLabel: { fontSize: 7.5, color: '#64748b', marginBottom: 2 },
  infoValue: { fontSize: 9, fontWeight: 700 },
  infoLine: { fontSize: 8.5, marginTop: 1, color: '#334155' },
  table: { marginTop: 18 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
  },
  colDescription: { width: '46%' },
  colQuantity: { width: '16%', textAlign: 'right' },
  colUnitPrice: { width: '19%', textAlign: 'right' },
  colAmount: { width: '19%', textAlign: 'right' },
  tableHeaderText: { fontSize: 8, fontWeight: 700, color: '#64748b' },
  totalsSection: { marginTop: 14, alignItems: 'flex-end' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginTop: 3,
  },
  totalsLabel: { fontSize: 8.5, color: '#475569' },
  totalsValue: { fontSize: 8.5 },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginTop: 6,
    padding: 8,
    borderRadius: 4,
  },
  grandTotalLabel: { fontSize: 10, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  noteSection: { marginTop: 18 },
  noteLabel: { fontSize: 8, fontWeight: 700, color: '#475569' },
  noteText: { fontSize: 8.5, marginTop: 2, color: '#334155' },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: { width: '42%' },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    marginTop: 36,
    paddingTop: 4,
  },
  signatureLabel: { fontSize: 8, color: '#475569', textAlign: 'center' },
  signatureDate: { fontSize: 7.5, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
})

interface DocumentPdfProps {
  company: Company
  customer: Customer | null
  document: DocumentRecord
  template: DocumentTemplateEnum
}

export function DocumentPdf({ company, customer, document: doc, template }: DocumentPdfProps) {
  const colors = palette[template] ?? palette.EXECUTIVE_CLASSIC
  const isDraft = doc.status === 'DRAFT'
  const revision = revisionLabel(doc.revisionNo)

  return (
    <Document title={`${documentTypeLabels[doc.documentType]}-${doc.documentNumber ?? 'DRAFT'}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { backgroundColor: colors.header }]}>
          <View>
            <Text style={[styles.headerCompanyName, { color: colors.headerText }]}>
              {sanitizeText(company.nameTh)}
            </Text>
            {company.address && (
              <Text style={[styles.headerLine, { color: colors.headerText }]}>{sanitizeText(company.address)}</Text>
            )}
            <Text style={[styles.headerLine, { color: colors.headerText }]}>
              เลขประจำตัวผู้เสียภาษี {sanitizeText(company.taxId)}
              {company.phone ? ` · โทร ${sanitizeText(company.phone)}` : ''}
            </Text>
          </View>
          <View>
            <Text style={[styles.headerDocType, { color: colors.headerText }]}>
              {documentTypeLabels[doc.documentType]}
            </Text>
            <Text style={[styles.headerDocNumber, { color: colors.headerText }]}>
              {doc.documentNumber ?? 'จะออกเลขเมื่ออนุมัติ'}
            </Text>
            {doc.parentDocumentId && (
              <Text style={[styles.headerRevision, { color: colors.headerText }]}>
                Revision {revision ?? '(ฉบับร่าง)'}
              </Text>
            )}
            <Text style={[styles.headerRevision, { color: colors.headerText }]}>
              สถานะ: {documentStatusLabels[doc.status]}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>ลูกค้า</Text>
            <Text style={styles.infoValue}>{customer ? sanitizeText(customer.name) : '-'}</Text>
            {customer?.address && <Text style={styles.infoLine}>{sanitizeText(customer.address)}</Text>}
            {customer?.taxId && <Text style={styles.infoLine}>เลขประจำตัวผู้เสียภาษี {sanitizeText(customer.taxId)}</Text>}
            {customer?.contactName && <Text style={styles.infoLine}>ผู้ติดต่อ {sanitizeText(customer.contactName)}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.infoLabel}>วันที่ออกเอกสาร</Text>
            <Text style={styles.infoLine}>{doc.issueDate ? formatThaiDate(doc.issueDate) : '-'}</Text>
            {doc.dueDate && (
              <>
                <Text style={[styles.infoLabel, { marginTop: 6 }]}>เงื่อนไขการชำระเงิน / ครบกำหนด</Text>
                <Text style={styles.infoLine}>{formatThaiDate(doc.dueDate)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHeaderRow, { borderBottomColor: colors.accent }]}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>รายการ</Text>
            <Text style={[styles.tableHeaderText, styles.colQuantity]}>จำนวน</Text>
            <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>ราคา/หน่วย</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>จำนวนเงิน</Text>
          </View>
          {doc.items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ fontSize: 8.5, color: '#94a3b8' }}>ยังไม่มีรายการ</Text>
            </View>
          ) : (
            doc.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.colDescription, { fontSize: 8.5 }]}>{sanitizeText(item.description)}</Text>
                <Text style={[styles.colQuantity, { fontSize: 8.5 }]}>
                  {item.quantity} {sanitizeText(item.unit ?? '')}
                </Text>
                <Text style={[styles.colUnitPrice, { fontSize: 8.5 }]}>{formatTHB(item.unitPrice)}</Text>
                <Text style={[styles.colAmount, { fontSize: 8.5 }]}>{formatTHB(item.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>รวมเป็นเงิน</Text>
            <Text style={styles.totalsValue}>{formatTHB(doc.subtotal)}</Text>
          </View>
          {doc.discountTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>ส่วนลด</Text>
              <Text style={styles.totalsValue}>-{formatTHB(doc.discountTotal)}</Text>
            </View>
          )}
          {doc.vatMode !== 'NON_VAT' && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {doc.vatMode === 'VAT_INCLUDED' ? 'ภาษีมูลค่าเพิ่ม (รวมในราคาแล้ว)' : 'ภาษีมูลค่าเพิ่ม 7%'}
              </Text>
              <Text style={styles.totalsValue}>{formatTHB(doc.vatAmount)}</Text>
            </View>
          )}
          <View style={[styles.grandTotalRow, { backgroundColor: colors.totalBg }]}>
            <Text style={[styles.grandTotalLabel, { color: colors.header }]}>ยอดรวมทั้งสิ้น</Text>
            <Text style={[styles.grandTotalValue, { color: colors.header }]}>{formatTHB(doc.grandTotal)}</Text>
          </View>
        </View>

        {doc.note && (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>หมายเหตุ</Text>
            <Text style={styles.noteText}>{sanitizeText(doc.note)}</Text>
          </View>
        )}

        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>ผู้จัดทำเอกสาร</Text>
            </View>
            <Text style={styles.signatureDate}>วันที่ ____________</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>{isDraft ? 'ผู้อนุมัติ (ยังไม่อนุมัติ)' : 'ผู้อนุมัติ'}</Text>
            </View>
            <Text style={styles.signatureDate}>วันที่ ____________</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
