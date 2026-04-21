import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/AccountStatementforBank-CASH-BANK_CASH-from2021-01-01to2026-04-19-incl-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).filter(r => r.object && r.Date instanceof Date)
console.log(`LP cash transactions: ${rows.length}`)

const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id
const toSaDate = (dt) => new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)

await q(`ALTER TABLE business_entries DISABLE TRIGGER trg_enforce_trust_business_link`)

let inserted = 0, skipped = 0
for (const r of rows) {
  // Some rows have ZAR Amount, some have AUD Amount with ZAR Balance
  const amount = Number(r['ZAR Amount'] ?? 0)
  if (amount === 0) {
    // AUD-only row — store narration but with 0 ZAR amount as note. Skip for ZAR books.
    console.log(`SKIP (AUD only): ${r.Reference} — ${r.Narration}`)
    skipped++
    continue
  }
  const contra = r['Contra Account Codes'] ?? ''
  // Multiple matters can be tagged: "M:JJ/DVG-001, M:JJ/DVG-002" — pick first
  const matterMatch = contra.match(/M:([^|;,\s]+)/)
  const matterCode = matterMatch?.[1]?.trim()
  const matterId = matterCode ? matters.get(matterCode) : null

  const isPositive = amount > 0
  const obj = r.object
  let entryType
  if (obj === 'Receipt' || obj === 'Business Receipt') {
    entryType = isPositive
      ? (matterId ? 'matter_receipt' : 'business_receipt')
      : (matterId ? 'matter_payment' : 'business_payment')
  } else if (obj === 'Payment' || obj === 'Business Payment') {
    entryType = !isPositive
      ? (matterId ? 'matter_payment' : 'business_payment')
      : (matterId ? 'matter_receipt' : 'business_receipt')
  } else {
    skipped++
    continue
  }

  await q(
    `INSERT INTO business_entries (id, matter_id, entry_type, entry_date, amount_cents, narration, reference_number, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2::"BusinessEntryType", $3, $4, $5, $6, $7, NOW(), NOW())`,
    [matterId, entryType, toSaDate(r.Date), Math.round(Math.abs(amount) * 100),
     `[CASH] ${r.Narration ?? ''}`, r.Reference, lpImportId]
  )
  console.log(`+ ${r.Reference} ${entryType.padEnd(18)} R${amount} matter=${matterCode || '—'}`)
  inserted++
}

await q(`ALTER TABLE business_entries ENABLE TRIGGER trg_enforce_trust_business_link`)

console.log(`\nInserted: ${inserted}, skipped (AUD/no amount): ${skipped}`)

const businessTotal = (await q(`SELECT COUNT(*)::int n FROM business_entries`))[0].n
console.log(`business_entries total: ${businessTotal}`)

await client.end()
