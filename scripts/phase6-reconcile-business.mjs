import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/AccountStatementforBank-BusinessBankaccount-BANK_bbank-from2021-01-01to2026-04-19-incl-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id
const toSaDate = (dt) => {
  if (!dt) return null
  if (dt instanceof Date) return new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return null
}

console.log('Clearing existing business_entries + journals…')
await q(`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE business_entry_id IS NOT NULL)`)
await q(`DELETE FROM journal_entries WHERE business_entry_id IS NOT NULL`)
await q(`DELETE FROM business_entries WHERE 1=1`)
await q(`ALTER TABLE business_entries DISABLE TRIGGER trg_enforce_trust_business_link`)

// Require object + Date — Reference can be absent (e.g. some "Staff Payment" rows)
const dataRows = rows.filter(r => r.object && r.Date instanceof Date)

let inserted = 0, skipped = 0
for (const r of dataRows) {
  const amount = Number(r['ZAR Amount'] ?? 0)
  if (amount === 0) { skipped++; continue }
  const abs = Math.round(Math.abs(amount) * 100)
  const contra = r['Contra Account Codes'] ?? ''
  const matterMatch = contra.match(/M:([^|;,\s]+)/)
  const matterCode = matterMatch?.[1]?.trim()
  const matterId = matterCode ? matters.get(matterCode) : null

  // Sign-aware type assignment (BANK perspective: +=money in, -=money out)
  // Keep the matter-tag distinction even for reversals
  let entryType
  const obj = r.object
  const isPositive = amount > 0

  if (obj === 'Business Receipt' || obj === 'Receipt') {
    // Positive = real receipt; Negative = refund (becomes payment)
    entryType = isPositive
      ? (matterId ? 'matter_receipt' : 'business_receipt')
      : (matterId ? 'matter_payment'  : 'business_payment')
  } else if (obj === 'Business Payment' || obj === 'Payment') {
    // Negative = real payment; Positive = deposit/reversal (becomes receipt)
    entryType = !isPositive
      ? (matterId ? 'matter_payment'  : 'business_payment')
      : (matterId ? 'matter_receipt'  : 'business_receipt')
  } else if (obj === 'Supplier Payment') {
    entryType = !isPositive ? 'supplier_payment' : 'business_receipt' // positive SP = refund
  } else if (obj === 'Staff Payment') {
    entryType = !isPositive ? 'business_payment' : 'business_receipt'
  } else {
    skipped++; continue
  }

  await q(
    `INSERT INTO business_entries (id, matter_id, entry_type, entry_date, amount_cents, narration, reference_number, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2::"BusinessEntryType", $3, $4, $5, $6, $7, NOW(), NOW())`,
    [matterId, entryType, toSaDate(r.Date), abs, r.Narration ?? '', r.Reference, lpImportId]
  )
  inserted++
}

await q(`ALTER TABLE business_entries ENABLE TRIGGER trg_enforce_trust_business_link`)

console.log(`inserted: ${inserted}, skipped: ${skipped}`)

const sum = await q(`
  SELECT entry_type::text, COUNT(*)::int n, SUM(amount_cents)::bigint / 100 AS total
  FROM business_entries GROUP BY entry_type ORDER BY entry_type
`)
console.log('\n── Business entries by type ──')
for (const r of sum) console.log(`  ${r.entry_type.padEnd(22)} ${String(r.n).padStart(5)}, R${r.total}`)

const net = (await q(`
  SELECT SUM(CASE
    WHEN entry_type IN ('matter_receipt','business_receipt','trust_to_business') THEN amount_cents
    WHEN entry_type IN ('matter_payment','business_payment','supplier_payment','supplier_invoice','bank_transfer') THEN -amount_cents
    ELSE 0 END)::bigint / 100.0 AS net
  FROM business_entries
`))[0].net
console.log(`\nCasey business balance: R${Number(net).toFixed(2)}`)
console.log(`LP closing balance:     R127,797.18`)
console.log(`Delta:                  R${(127797.18 - Number(net)).toFixed(2)}`)

await client.end()
