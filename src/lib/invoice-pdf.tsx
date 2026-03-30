import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Invoice, InvoiceLineItem } from '@/generated/prisma'

// ─── Font registration ────────────────────────────────────────────────────────

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'PlayfairDisplay',
  src: path.join(fontsDir, 'PlayfairDisplay.ttf'),
})

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: path.join(fontsDir, 'NotoSans.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'NotoSans.ttf'), fontWeight: 700 },
  ],
})

// DM Mono removed — using NotoSans instead

// ─── Colours ──────────────────────────────────────────────────────────────────

const roseTaupe = '#B08B82'
const charcoal = '#1C1C1A'
const warmGrey = '#8A857E'
const lightRule = '#DDD6CE'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSans',
    fontSize: 9,
    color: charcoal,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
    backgroundColor: '#FFFFFF',
  },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  firmNameBlock: { flex: 1, paddingLeft: 16 },
  firmName: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 18,
    color: charcoal,
    marginBottom: 3,
  },
  firmAddress: { fontSize: 8, color: warmGrey, lineHeight: 1.5 },

  // Doc type banner
  docTypeBanner: {
    borderTopWidth: 1,
    borderTopColor: roseTaupe,
    borderBottomWidth: 1,
    borderBottomColor: roseTaupe,
    paddingVertical: 4,
    marginBottom: 16,
  },
  docType: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 13,
    color: roseTaupe,
    letterSpacing: 2,
  },

  // Invoice meta row
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaLeft: { flex: 1 },
  metaRight: { flex: 1, alignItems: 'flex-end' },
  metaLabel: { fontSize: 7, color: warmGrey, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontFamily: 'NotoSans', fontSize: 9, color: charcoal, marginTop: 1 },

  // Bill-to block
  billToSection: { marginBottom: 20 },
  billToLabel: { fontSize: 7, color: warmGrey, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  billToRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billToName: { fontSize: 10, fontWeight: 700, color: charcoal },
  accRef: { fontFamily: 'NotoSans', fontSize: 8, color: warmGrey },

  // Matter heading
  matterHeading: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 13,
    color: roseTaupe,
    marginBottom: 12,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: lightRule,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: lightRule,
  },
  tableRowAlt: {
    backgroundColor: '#FAF8F5',
  },

  // Column widths
  colDate: { width: 52 },
  colCentre: { width: 90 },
  colDesc: { flex: 1 },
  colQty: { width: 44, alignItems: 'flex-end' },
  colRate: { width: 54, alignItems: 'flex-end' },
  colTotal: { width: 60, alignItems: 'flex-end' },

  colHeaderText: {
    fontSize: 7,
    color: warmGrey,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cellText: { fontSize: 8.5, color: charcoal },
  cellMono: { fontFamily: 'NotoSans', fontSize: 8, color: charcoal },
  cellMonoMuted: { fontFamily: 'NotoSans', fontSize: 8, color: warmGrey },

  // Totals
  totalsSection: { marginTop: 12, alignItems: 'flex-end' },
  totalsTable: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalsLabel: { fontSize: 8, color: warmGrey },
  totalsValue: { fontFamily: 'NotoSans', fontSize: 9, color: charcoal },
  totalsDivider: { borderTopWidth: 1, borderTopColor: lightRule, marginVertical: 3 },
  totalsGrandLabel: { fontSize: 9, fontWeight: 700, color: charcoal },
  totalsGrand: { fontFamily: 'NotoSans', fontSize: 10, color: charcoal, fontWeight: 700 },

  // Banking footer
  bankingBlock: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: lightRule,
    paddingTop: 10,
  },
  bankingLabel: {
    fontSize: 8,
    color: warmGrey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bankingRow: { fontSize: 8, color: charcoal, marginBottom: 2 },
  bankingRef: { fontSize: 8, fontWeight: 700, color: roseTaupe, marginTop: 4 },

  // Footer note
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: lightRule,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: warmGrey },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRand(cents: number): string {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function durationLabel(item: InvoiceLineItem): string {
  if (item.entryType === 'time' && item.durationMinutesBilled !== null) {
    const h = Math.floor(item.durationMinutesBilled / 60)
    const m = item.durationMinutesBilled % 60
    return h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`
  }
  if (item.entryType === 'unitary' && item.unitQuantityThousandths !== null) {
    return `×${(item.unitQuantityThousandths / 1000).toFixed(2)}`
  }
  return '—'
}

// ─── Document ─────────────────────────────────────────────────────────────────

type InvoiceWithItems = Invoice & { lineItems: InvoiceLineItem[] }

interface InvoicePDFProps {
  invoice: InvoiceWithItems
  logoPath?: string
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const isProForma = invoice.invoiceType === 'pro_forma'
  const docTypeLabel = isProForma ? 'PRO FORMA INVOICE' : invoice.vatRegistered ? 'TAX INVOICE' : 'INVOICE'

  const firmAddressLines = [invoice.firmAddress, invoice.firmTel, invoice.firmEmail, invoice.firmWebsite]
    .filter(Boolean)
    .join('\n')

  return (
    <Document
      title={`${docTypeLabel} ${invoice.invoiceNumber}`}
      author={invoice.firmName}
    >
      <Page size="A4" style={styles.page}>

        {/* Header: firm details */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.firmNameBlock}>
            <Text style={styles.firmName}>{invoice.firmName}</Text>
            {firmAddressLines ? (
              <Text style={styles.firmAddress}>{firmAddressLines}</Text>
            ) : null}
          </View>
        </View>

        {/* Doc type banner */}
        <View style={styles.docTypeBanner}>
          <Text style={styles.docType}>{docTypeLabel}</Text>
        </View>

        {/* Invoice meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaLabel}>Invoice No</Text>
            <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            {invoice.vatRegistered && invoice.vatRegNumber ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 6 }]}>VAT Reg No</Text>
                <Text style={styles.metaValue}>{invoice.vatRegNumber}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{fmtDate(invoice.invoiceDate)}</Text>
          </View>
        </View>

        {/* Bill to */}
        <View style={styles.billToSection}>
          <Text style={styles.billToLabel}>Invoice To</Text>
          <View style={styles.billToRow}>
            <Text style={styles.billToName}>{invoice.clientName}</Text>
            <Text style={styles.accRef}>Your Acc: {invoice.matterCode}</Text>
          </View>
        </View>

        {/* Matter heading */}
        <Text style={styles.matterHeading}>{invoice.matterDescription}</Text>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <View style={styles.colDate}><Text style={styles.colHeaderText}>Date</Text></View>
          <View style={styles.colCentre}><Text style={styles.colHeaderText}>Cost Centre</Text></View>
          <View style={styles.colDesc}><Text style={styles.colHeaderText}>Description</Text></View>
          <View style={styles.colQty}><Text style={styles.colHeaderText}>Qty</Text></View>
          <View style={styles.colRate}><Text style={styles.colHeaderText}>Unit</Text></View>
          <View style={styles.colTotal}><Text style={styles.colHeaderText}>Total</Text></View>
        </View>

        {/* Line items */}
        {invoice.lineItems.map((item, i) => (
          <View
            key={item.id}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <View style={styles.colDate}>
              <Text style={styles.cellText}>{fmtDate(item.entryDate)}</Text>
            </View>
            <View style={styles.colCentre}>
              <Text style={styles.cellText}>{item.costCentre}</Text>
            </View>
            <View style={styles.colDesc}>
              <Text style={styles.cellText}>{item.description}</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.cellMonoMuted}>{durationLabel(item)}</Text>
            </View>
            <View style={styles.colRate}>
              <Text style={styles.cellMonoMuted}>
                {item.rateCents > 0 ? fmtRand(item.rateCents) : '—'}
              </Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.cellMono}>{fmtRand(item.totalCents)}</Text>
              {item.discountPct > 0 && (
                <Text style={[styles.cellMonoMuted, { fontSize: 7 }]}>
                  {item.discountPct}% disc
                </Text>
              )}
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            {invoice.vatRegistered ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal (excl. VAT)</Text>
                  <Text style={styles.totalsValue}>{fmtRand(invoice.subTotalCents)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>
                    VAT ({((invoice.vatRateBps / 10000) * 100).toFixed(0)}%)
                  </Text>
                  <Text style={styles.totalsValue}>{fmtRand(invoice.vatCents)}</Text>
                </View>
                <View style={styles.totalsDivider} />
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsGrandLabel}>Total (incl. VAT)</Text>
                  <Text style={styles.totalsGrand}>{fmtRand(invoice.totalCents)}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.totalsDivider} />
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsGrandLabel}>Total</Text>
                  <Text style={styles.totalsGrand}>{fmtRand(invoice.totalCents)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Banking details */}
        {(invoice.trustBankName || invoice.invoicePaymentInstructions) ? (
          <View style={styles.bankingBlock}>
            <Text style={styles.bankingLabel}>Payment Details</Text>
            {invoice.invoicePaymentInstructions ? (
              <Text style={styles.bankingRow}>{invoice.invoicePaymentInstructions}</Text>
            ) : null}
            {invoice.trustBankName ? (
              <Text style={styles.bankingRow}>
                {[
                  invoice.trustBankName,
                  invoice.trustBankAccountName,
                  invoice.trustBankAccountNumber ? `Acc: ${invoice.trustBankAccountNumber}` : null,
                  invoice.trustBankBranchCode ? `Branch: ${invoice.trustBankBranchCode}` : null,
                ]
                  .filter(Boolean)
                  .join('  |  ')}
              </Text>
            ) : null}
            <Text style={styles.bankingRef}>
              Payment reference: {invoice.matterCode}
            </Text>
          </View>
        ) : null}

        {/* Page footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>{invoice.invoiceNumber}</Text>
          <Text style={styles.footerText}>{invoice.firmName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
