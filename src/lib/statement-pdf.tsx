import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'

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

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  firmNameBlock: { flex: 1, paddingLeft: 16 },
  firmName: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 18,
    color: charcoal,
    marginBottom: 3,
  },
  firmAddress: { fontSize: 8, color: warmGrey, lineHeight: 1.5 },

  banner: {
    borderTopWidth: 1,
    borderTopColor: roseTaupe,
    borderBottomWidth: 1,
    borderBottomColor: roseTaupe,
    paddingVertical: 4,
    marginBottom: 16,
  },
  bannerText: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 13,
    color: roseTaupe,
    letterSpacing: 2,
  },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaLabel: { fontSize: 7, color: warmGrey, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  metaValue: { fontSize: 9, color: charcoal },

  rule: { borderBottomWidth: 1, borderBottomColor: lightRule, marginVertical: 12 },

  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: lightRule,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0EC',
  },
  colDate: { width: 70 },
  colRef: { width: 80 },
  colDesc: { flex: 1 },
  colDebit: { width: 72, textAlign: 'right' },
  colCredit: { width: 72, textAlign: 'right' },
  colBalance: { width: 80, textAlign: 'right' },

  thText: { fontSize: 7, color: warmGrey, textTransform: 'uppercase', letterSpacing: 0.8 },
  tdText: { fontSize: 8, color: charcoal },
  tdMuted: { fontSize: 8, color: warmGrey },

  totalsRow: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: roseTaupe,
    paddingTop: 6,
    marginTop: 4,
  },
  totalLabel: { flex: 1, fontSize: 8, fontWeight: 700, color: charcoal, textTransform: 'uppercase', letterSpacing: 0.8 },
  totalValue: { width: 80, textAlign: 'right', fontSize: 10, fontWeight: 700, color: roseTaupe },

  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: lightRule,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: warmGrey },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatementEntry {
  date: string
  type: 'invoice' | 'receipt'
  reference: string
  description: string
  debitCents: number
  creditCents: number
  balanceCents: number
}

interface StatementClient {
  clientCode: string
  clientName: string
}

interface StatementPDFProps {
  client: StatementClient
  entries: StatementEntry[]
  totals: { debitCents: number; creditCents: number; closingBalanceCents: number }
  firmName: string
  firmAddress?: string
  fromDate?: string
  toDate?: string
}

function fmtCents(cents: number) {
  return `R ${(Math.abs(cents) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function StatementPDF({ client, entries, totals, firmName, firmAddress, fromDate, toDate }: StatementPDFProps) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
  const period = fromDate && toDate
    ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}`
    : fromDate
    ? `From ${fmtDate(fromDate)}`
    : toDate
    ? `To ${fmtDate(toDate)}`
    : 'All Dates'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.firmNameBlock}>
            <Text style={styles.firmName}>{firmName}</Text>
            {firmAddress && <Text style={styles.firmAddress}>{firmAddress}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: warmGrey }}>Statement Date</Text>
            <Text style={{ fontSize: 9, color: charcoal, marginTop: 2 }}>{today}</Text>
          </View>
        </View>

        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>CLIENT STATEMENT</Text>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{client.clientName}</Text>
            <Text style={{ fontSize: 8, color: warmGrey, marginTop: 2 }}>{client.clientCode}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>{period}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Table header */}
        <View style={styles.tableHeader}>
          <View style={styles.colDate}><Text style={styles.thText}>Date</Text></View>
          <View style={styles.colRef}><Text style={styles.thText}>Reference</Text></View>
          <View style={styles.colDesc}><Text style={styles.thText}>Description</Text></View>
          <View style={styles.colDebit}><Text style={styles.thText}>Debit</Text></View>
          <View style={styles.colCredit}><Text style={styles.thText}>Credit</Text></View>
          <View style={styles.colBalance}><Text style={styles.thText}>Balance</Text></View>
        </View>

        {/* Entries */}
        {entries.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={{ fontSize: 9, color: warmGrey, textAlign: 'center' }}>No transactions for this period.</Text>
          </View>
        ) : (
          entries.map((entry, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colDate}><Text style={styles.tdMuted}>{fmtDate(entry.date)}</Text></View>
              <View style={styles.colRef}><Text style={styles.tdMuted}>{entry.reference}</Text></View>
              <View style={styles.colDesc}><Text style={styles.tdText}>{entry.description}</Text></View>
              <View style={styles.colDebit}>
                <Text style={{ ...styles.tdText, color: entry.debitCents ? '#C0392B' : warmGrey }}>
                  {entry.debitCents ? fmtCents(entry.debitCents) : ''}
                </Text>
              </View>
              <View style={styles.colCredit}>
                <Text style={{ ...styles.tdText, color: entry.creditCents ? '#27AE60' : warmGrey }}>
                  {entry.creditCents ? fmtCents(entry.creditCents) : ''}
                </Text>
              </View>
              <View style={styles.colBalance}>
                <Text style={{ ...styles.tdText, fontWeight: 700, color: entry.balanceCents > 0 ? charcoal : '#27AE60' }}>
                  {fmtCents(entry.balanceCents)}{entry.balanceCents < 0 ? ' Cr' : ''}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text style={styles.totalLabel}>Closing Balance</Text>
          <View style={styles.colDebit}><Text style={{ fontSize: 9, fontWeight: 700, color: charcoal, textAlign: 'right' }}>{fmtCents(totals.debitCents)}</Text></View>
          <View style={styles.colCredit}><Text style={{ fontSize: 9, fontWeight: 700, color: charcoal, textAlign: 'right' }}>{fmtCents(totals.creditCents)}</Text></View>
          <View style={styles.colBalance}><Text style={{ fontSize: 10, fontWeight: 700, color: roseTaupe, textAlign: 'right' }}>{fmtCents(totals.closingBalanceCents)}{totals.closingBalanceCents < 0 ? ' Cr' : ''}</Text></View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{firmName} — Confidential</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
