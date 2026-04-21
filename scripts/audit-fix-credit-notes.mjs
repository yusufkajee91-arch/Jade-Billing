import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/Invoiced-Fees-and-Disbursements (1).xlsx', { cellDates: true })
const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
const cnRows = allRows.filter(r => r.Reference && r.Reference.startsWith('CN'))
console.log(`LP CN line items: ${cnRows.length}`)

// Group by Reference
const cnByRef = {}
for (const r of cnRows) {
  cnByRef[r.Reference] ||= { lines: [], date: r['Date Invoiced'], matter: r['Matter Code'], customer: r['Customer'] }
  cnByRef[r.Reference].lines.push(r)
}
console.log(`Distinct CN refs: ${Object.keys(cnByRef).length}`)

const matters = new Map((await q(`SELECT id, matter_code, client_id FROM matters`)).map(r => [r.matter_code, r]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id
const firm = (await q(`SELECT * FROM firm_settings LIMIT 1`))[0] ?? {}

const toSaDate = (dt) => {
  if (!dt) return null
  if (dt instanceof Date) return new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (typeof dt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dt)) return dt.slice(0,10)
  return null
}

let inserted = 0, skipped = 0
for (const [ref, group] of Object.entries(cnByRef)) {
  // Skip if already exists
  const existing = await q(`SELECT id FROM invoices WHERE invoice_number = $1`, [ref])
  if (existing.length) { skipped++; continue }

  const matter = matters.get(group.matter)
  if (!matter) { console.log(`SKIP ${ref}: matter ${group.matter} not found`); continue }

  // Sum line totals (CN amounts are typically negative — reversals)
  const sumFees = group.lines.reduce((s, r) => s + Number(r['FEES Amount'] ?? 0), 0)
  const sumDisb = group.lines.reduce((s, r) => s + Number(r['DISBURSEMENTS Amount'] ?? 0), 0)
  const sumVat  = group.lines.reduce((s, r) => s + Number(r['vat Amount'] ?? 0), 0)
  const subTotal = sumFees + sumDisb
  const total = subTotal + sumVat

  const invoiceDate = toSaDate(group.date)

  // Find original invoice ref via narration "[INVxxxx]" pattern in any line
  let originalInvId = null
  for (const line of group.lines) {
    const m = (line.Narration ?? '').match(/INV\d{4,}/)
    if (m) {
      const orig = await q(`SELECT id FROM invoices WHERE invoice_number = $1`, [m[0]])
      if (orig.length) { originalInvId = orig[0].id; break }
    }
  }

  const newInvId = (await q(
    `INSERT INTO invoices (id, invoice_number, invoice_type, status, matter_id, client_id,
      matter_code, matter_description, client_name, firm_name, vat_registered, vat_rate_bps,
      sub_total_cents, vat_cents, total_cents, invoice_date, is_historical, original_invoice_id,
      created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, 'credit_note', 'sent_invoice', $2, $3,
      $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, $15, NOW(), NOW())
     RETURNING id`,
    [ref, matter.id, matter.client_id,
     group.matter, group.matter, group.customer ?? '',
     firm.firm_name ?? 'Dolata & Co', firm.vat_registered ?? false, firm.vat_rate_bps ?? 1500,
     Math.round(subTotal * 100), Math.round(sumVat * 100), Math.round(total * 100),
     invoiceDate, originalInvId, lpImportId]
  ))[0].id

  // Add line items
  let sortOrder = 0
  for (const line of group.lines) {
    const lineFees = Number(line['FEES Amount'] ?? 0)
    const lineDisb = Number(line['DISBURSEMENTS Amount'] ?? 0)
    const lineTotal = lineFees + lineDisb
    const entryType = lineDisb !== 0 ? 'disbursement' : (line.Minutes ? 'time' : 'unitary')
    await q(
      `INSERT INTO invoice_line_items (id, invoice_id, entry_date, entry_type, cost_centre, description,
        duration_minutes_billed, unit_quantity_thousandths, rate_cents, amount_cents,
        discount_pct, discount_cents, total_cents, sort_order)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, $11)`,
      [newInvId, toSaDate(line.Date), entryType, line['Posting Code'] ?? '', line.Narration ?? '',
       line.Minutes ? Math.round(Number(line.Minutes)) : null,
       line.Qty ? Math.round(Number(line.Qty) * 1000) : null,
       Math.round(Number(line['Unit Price'] ?? 0) * 100),
       Math.round(lineTotal * 100),
       Math.round(lineTotal * 100),
       sortOrder++]
    )
  }
  inserted++
}

console.log(`\nInserted: ${inserted} credit notes, skipped: ${skipped}`)

// Verify
const check = await q(`
  SELECT invoice_type, COUNT(*)::int n, (SUM(total_cents)/100.0)::numeric(14,2) AS total
  FROM invoices GROUP BY invoice_type ORDER BY invoice_type
`)
console.log('\n── Invoices by type ──')
for (const r of check) console.log(`  ${r.invoice_type.padEnd(15)} ${String(r.n).padStart(4)}  R${r.total}`)
const totalLines = (await q(`SELECT COUNT(*)::int n FROM invoice_line_items`))[0].n
console.log(`Total invoice line items: ${totalLines} (LP: 3,223)`)

await client.end()
