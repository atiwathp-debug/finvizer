import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { THAI_FONT_FAMILY, registerPdfFonts } from '@/lib/pdf/fonts'
import { sanitizeText } from '@/lib/pdf/sanitizeText'
import { formatTHB, formatThaiDate } from '@/lib/utils/currency'
import { getTemplatePalette } from '@/lib/templates/previewPalette'
import { documentStatusLabels, documentTypeLabels, revisionLabel, type DocumentRecord } from '@/types/document'
import type { Company } from '@/types/company'
import type { Customer } from '@/types/customer'
import type { DocumentTemplateEnum } from '@/types/database'
import type { SignatureSlot } from '@/types/signature'
import type { DocumentInstallment } from '@/types/documentInstallment'

registerPdfFonts()

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
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerLogo: { width: 32, height: 32, objectFit: 'contain' },
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
  installmentSection: { marginTop: 16 },
  installmentSectionLabel: { fontSize: 8, fontWeight: 700, color: '#475569', marginBottom: 4 },
  colInstallmentNo: { width: '10%' },
  colInstallmentNote: { width: '40%' },
  colInstallmentDueDate: { width: '25%' },
  colInstallmentAmount: { width: '25%', textAlign: 'right' },
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 24,
  },
  signatureBox: { width: '30%', minWidth: 140 },
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
  /** Company's configured signature slots, already fallback-wrapped by the caller (see generateDocumentPdf.tsx). */
  signatureSlots: SignatureSlot[]
  /** This document's installment payment plan, if any — renders an extra table when non-empty. */
  installments: DocumentInstallment[]
}

export function DocumentPdf({ company, customer, document: doc, template, signatureSlots, installments }: DocumentPdfProps) {
  const colors = getTemplatePalette(template)
  const revision = revisionLabel(doc.revisionNo)

  return (
    <Document title={`${documentTypeLabels[doc.documentType]}-${doc.documentNumber ?? 'DRAFT'}`}>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.header,
            colors.headerBorderColor
              ? { backgroundColor: colors.header, borderWidth: 1.5, borderColor: colors.headerBorderColor }
              : { backgroundColor: colors.header },
          ]}
        >
          <View style={styles.headerLeft}>
            {company.logoUrl && <Image src={company.logoUrl} style={styles.headerLogo} />}
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

        {installments.length > 0 && (
          <View style={styles.installmentSection}>
            <Text style={styles.installmentSectionLabel}>เงื่อนไขการชำระเงิน (แบ่งชำระเป็นงวด)</Text>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.accent }]}>
              <Text style={[styles.tableHeaderText, styles.colInstallmentNo]}>งวดที่</Text>
              <Text style={[styles.tableHeaderText, styles.colInstallmentNote]}>รายละเอียด</Text>
              <Text style={[styles.tableHeaderText, styles.colInstallmentDueDate]}>ครบกำหนด</Text>
              <Text style={[styles.tableHeaderText, styles.colInstallmentAmount]}>จำนวนเงิน</Text>
            </View>
            {installments.map((installment) => (
              <View key={installment.id} style={styles.tableRow}>
                <Text style={[styles.colInstallmentNo, { fontSize: 8.5 }]}>{installment.installmentNo}</Text>
                <Text style={[styles.colInstallmentNote, { fontSize: 8.5 }]}>
                  {installment.note ? sanitizeText(installment.note) : '-'}
                </Text>
                <Text style={[styles.colInstallmentDueDate, { fontSize: 8.5 }]}>
                  {installment.dueDate ? formatThaiDate(installment.dueDate) : '-'}
                </Text>
                <Text style={[styles.colInstallmentAmount, { fontSize: 8.5 }]}>
                  {formatTHB(installment.computedAmount)}
                </Text>
              </View>
            ))}
          </View>
        )}

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
          <View
            style={[
              styles.grandTotalRow,
              colors.headerBorderColor
                ? { backgroundColor: colors.totalBg, borderWidth: 1, borderColor: colors.headerBorderColor }
                : { backgroundColor: colors.totalBg },
            ]}
          >
            <Text style={[styles.grandTotalLabel, { color: colors.grandTotalTextColor }]}>ยอดรวมทั้งสิ้น</Text>
            <Text style={[styles.grandTotalValue, { color: colors.grandTotalTextColor }]}>{formatTHB(doc.grandTotal)}</Text>
          </View>
        </View>

        {doc.note && (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>หมายเหตุ</Text>
            <Text style={styles.noteText}>{sanitizeText(doc.note)}</Text>
          </View>
        )}

        <View style={styles.signatureSection}>
          {signatureSlots.map((slot) => (
            <View key={slot.id} style={styles.signatureBox}>
              <View style={styles.signatureLine}>
                <Text style={styles.signatureLabel}>{sanitizeText(slot.label)}</Text>
              </View>
              <Text style={styles.signatureDate}>วันที่ ____________</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
