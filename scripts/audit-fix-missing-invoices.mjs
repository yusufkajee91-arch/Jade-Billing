import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/Invoiced-Fees-and-Disbursements (1).xlsx', { cellDates: true })
const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

const missingRefs = ['INV1365', 'INV1366', 'INV1367', 'INV1368', 'INV1369', 'INV1371', 'INV1372']

const matters = new Map((await q(`SELECT id, matter_code, client_id FROM matters`)).map(r => [r.matter_code, r]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id
const firm = (await q(`SELECT * FROM firm_settings LIMIT 1`))[0] ?? {}

const toSaDate = (dt) => {
  if (!dt) return null
  if (dt instanceof Date) return new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return null
}

let inserted = 0
for (const ref of missingRefs) {
  const lines = allRows.filter(r => r.Reference === ref)
  if (lines.length === 0) { console.log(`SKIP ${ref}: no LP lines`); continue }
  const matter = matters.get(lines[0]['Matter Code'])
  if (!matter) { console.log(`SKIP ${ref}: matter ${lines[0]['Matter Code']} not in Casey`); continue }

  const sumFees = lines.reduce((s, r) => s + Number(r['FEES Amount'] ?? 0), 0)
  const sumDisb = lines.reduce((s, r) => s + Number(r['DISBURSEMENTS Amount'] ?? 0), 0)
  const sumVat  = lines.reduce((s, r) => s + Number(r['vat Amount'] ?? 0), 0)
  const subTotal = sumFees + sumDisb
  const total = subTotal + sumVat

  const newId = (await q(
    `INSERT INTO invoices (id, invoice_number, invoice_type, status, matter_id, client_id,
      matter_code, matter_description, client_name, firm_name, vat_registered, vat_rate_bps,
      sub_total_cents, vat_cents, total_cents, invoice_date, is_historical, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, 'invoice', 'sent_invoice', $2, $3,
      $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, NOW(), NOW())
     RETURNING id`,
    [ref, matter.id, matter.client_id,
     lines[0]['Matter Code'], (lines[0]['Matter Name'] ?? '').toString().trim() || lines[0]['Matter Code'],
     (lines[0].Customer ?? '').toString().trim(),
     firm.firm_name ?? 'Dolata & Co', firm.vat_registered ?? false, firm.vat_rate_bps ?? 1500,
     Math.round(subTotal * 100), Math.round(sumVat * 100), Math.round(total * 100),
     toSaDate(lines[0]['Date Invoiced']), lpImportId]
  ))[0].id

  let sortOrder = 0
  for (const line of lines) {
    const lineFees = Number(line['FEES Amount'] ?? 0)
    const lineDisb = Number(line['DISBURSEMENTS Amount'] ?? 0)
    const lineTotal = lineFees + lineDisb
    const entryType = lineDisb !== 0 ? 'disbursement' : (line.Minutes ? 'time' : 'unitary')
    await q(
      `INSERT INTO invoice_line_items (id, invoice_id, entry_date, entry_type, cost_centre, description,
        duration_minutes_billed, unit_quantity_thousandths, rate_cents, amount_cents,
        discount_pct, discount_cents, total_cents, sort_order)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, $11)`,
      [newId, toSaDate(line.Date), entryType, line['Posting Code'] ?? '', line.Narration ?? '',
       line.Minutes ? Math.round(Number(line.Minutes)) : null,
       line.Qty ? Math.round(Number(line.Qty) * 1000) : null,
       Math.round(Number(line['Unit Price'] ?? 0) * 100),
       Math.round(lineTotal * 100),
       Math.round(lineTotal * 100),
       sortOrder++]
    )
  }
  console.log(`Inserted ${ref}: ${lines.length} lines, total R${total}`)
  inserted++
}

console.log(`\n${inserted} invoices inserted`)

const final = await q(`
  SELECT 'invoices' k, COUNT(*)::int n FROM invoices
  UNION ALL SELECT 'invoice_line_items', COUNT(*) FROM invoice_line_items
`)
for (const r of final) console.log(`  ${r.k.padEnd(22)} ${r.n}`)

await client.end()
