import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/AccountStatementforBank-BusinessBankaccount-BANK_bbank-from2021-01-01to2026-04-19-incl-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
console.log(`Business bank rows: ${rows.length}`)

const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id

const toSaDate = (dt) => {
  if (!dt) return null
  if (dt instanceof Date) return new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (typeof dt === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dt)) return dt.slice(0, 10)
    const d = new Date(dt); if (isNaN(d)) return null
    return new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  return null
}

const dataRows = rows.filter(r => r.object && r.Reference && r.Date instanceof Date)
console.log(`Data rows: ${dataRows.length}`)

// Clear existing + related journal entries
await q(`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE business_entry_id IS NOT NULL)`)
await q(`DELETE FROM journal_entries WHERE business_entry_id IS NOT NULL`)
await q(`DELETE FROM business_entries WHERE 1=1`)

// Disable the enforce_trust_business_link trigger during historical import
await q(`ALTER TABLE business_entries DISABLE TRIGGER trg_enforce_trust_business_link`)

let inserted = 0, skippedUnknownType = 0
for (const r of dataRows) {
  const obj = r.object // "Business Receipt" | "Business Payment"
  const amount = Number(r['ZAR Amount'] ?? 0)
  const contra = r['Contra Account Codes'] ?? ''

  // Match matter from contra "M:CODE"
  const matterMatch = contra.match(/M:([^|;,\s]+)/)
  const matterCode = matterMatch?.[1]?.trim()
  const matterId = matterCode ? matters.get(matterCode) : null

  // Determine entry_type
  let entryType, supplierId = null
  if (obj === 'Business Receipt' || obj === 'Receipt') {
    entryType = matterId ? 'matter_receipt' : 'business_receipt'
  } else if (obj === 'Business Payment' || obj === 'Payment') {
    entryType = matterId ? 'matter_payment' : 'business_payment'
  } else if (obj === 'Supplier Payment') {
    entryType = 'supplier_payment'
    // Could link supplier by contra "S:CODE" — skip for now to keep simple
  } else {
    skippedUnknownType++
    continue
  }

  await q(
    `INSERT INTO business_entries (id, matter_id, entry_type, entry_date, amount_cents, narration, reference_number, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2::"BusinessEntryType", $3, $4, $5, $6, $7, NOW(), NOW())`,
    [matterId, entryType, toSaDate(r.Date), Math.round(Math.abs(amount) * 100), r.Narration ?? '', r.Reference, lpImportId]
  )
  inserted++
}

// Re-enable trigger
await q(`ALTER TABLE business_entries ENABLE TRIGGER trg_enforce_trust_business_link`)

console.log(`\ninserted: ${inserted}, skipped (unknown type): ${skippedUnknownType}`)

// Summary
const sum = await q(`
  SELECT entry_type::text, COUNT(*)::int n, SUM(amount_cents)::bigint / 100 AS total
  FROM business_entries GROUP BY entry_type ORDER BY entry_type
`)
console.log('\n── Business entries by type ──')
for (const r of sum) console.log(`  ${r.entry_type.padEnd(22)} ${String(r.n).padStart(5)}, R${r.total}`)

// Net bank balance
const net = (await q(`
  SELECT SUM(CASE WHEN entry_type IN ('matter_receipt','business_receipt','trust_to_business') THEN amount_cents
              WHEN entry_type IN ('matter_payment','business_payment','supplier_payment') THEN -amount_cents
              ELSE 0 END)::bigint / 100.0 AS balance
  FROM business_entries
`))[0].balance
console.log(`\nNet business bank balance: R${Number(net).toFixed(2)}`)
console.log(`LP closing balance:        R127,797.18`)

await client.end()
