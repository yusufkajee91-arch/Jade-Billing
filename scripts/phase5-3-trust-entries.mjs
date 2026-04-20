import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/AccountStatementforBank-Trustbankaccount-BANK_tbank-from2021-01-01to2026-04-19-incl-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
console.log(`Trust bank rows: ${rows.length}`)

const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id

// Toss header, opening/closing balance, footer rows — keep only ones with `object` type
const dataRows = rows.filter(r => r.object && r.Reference && r.Date instanceof Date)
console.log(`Data rows: ${dataRows.length}`)

const toSaDate = (dt) => new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)

const typeMap = {
  'Trust Receipt': 'trust_receipt',
  'Trust Payment': 'trust_payment',
  'Trust Transfer': null, // decided per sign below
}

// Truncate existing (cascades to journal entries via FK ON DELETE SET NULL)
await q(`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE trust_entry_id IS NOT NULL)`)
await q(`DELETE FROM journal_entries WHERE trust_entry_id IS NOT NULL`)
await q(`DELETE FROM trust_entries WHERE 1=1`)

// Disable balance-check trigger for historical import; keep GL journal trigger active
console.log('Disabling check_trust_balance trigger for bulk import…')
await q(`ALTER TABLE trust_entries DISABLE TRIGGER trg_check_trust_balance`)

let inserted = 0, skipped = { noMatter: 0, noType: 0 }
for (const r of dataRows) {
  const obj = r.object
  const amount = Number(r['ZAR Amount (T)'] ?? 0)
  const contra = r['Contra Account Codes'] ?? ''
  let entryType = typeMap[obj]
  if (entryType === null && obj === 'Trust Transfer') {
    entryType = amount > 0 ? 'trust_transfer_in' : 'trust_transfer_out'
  }
  if (!entryType) { skipped.noType++; continue }

  // Match matter from Contra: "M:JJ/JSB-001" → matter_code "JJ/JSB-001"
  const matterMatch = contra.match(/M:([^|;,\s]+)/)
  const matterCode = matterMatch?.[1]?.trim()
  const matterId = matterCode ? matters.get(matterCode) : null
  if (!matterId) { skipped.noMatter++; continue }

  const amountCents = Math.round(Math.abs(amount) * 100)
  await q(
    `INSERT INTO trust_entries (id, matter_id, entry_type, entry_date, amount_cents, narration, reference_number, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2::"TrustEntryType", $3, $4, $5, $6, $7, NOW(), NOW())`,
    [matterId, entryType, toSaDate(r.Date), amountCents, r.Narration ?? '', r.Reference, lpImportId]
  )
  inserted++
}

console.log(`inserted: ${inserted}`)
console.log(`skipped: ${JSON.stringify(skipped)}`)

// Re-enable balance trigger now that all historical data is in
console.log('Re-enabling check_trust_balance trigger…')
await q(`ALTER TABLE trust_entries ENABLE TRIGGER trg_check_trust_balance`)

// Verify: are any matter balances negative after import?
const negBalances = await q(`
  SELECT m.matter_code, SUM(
    CASE WHEN te.entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN te.amount_cents
         WHEN te.entry_type IN ('trust_payment','trust_transfer_out') THEN -te.amount_cents
         ELSE 0 END
  ) / 100.0 AS balance
  FROM trust_entries te JOIN matters m ON te.matter_id = m.id
  GROUP BY m.matter_code
  HAVING SUM(CASE WHEN te.entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN te.amount_cents
               WHEN te.entry_type IN ('trust_payment','trust_transfer_out') THEN -te.amount_cents
               ELSE 0 END) < 0
  ORDER BY balance
  LIMIT 20
`)
if (negBalances.length > 0) {
  console.log(`\n⚠️  ${negBalances.length} matters with negative trust balance:`)
  for (const r of negBalances) console.log(`  ${r.matter_code}: R${Number(r.balance).toFixed(2)}`)
}

// Summary
const summary = await q(`
  SELECT entry_type::text, COUNT(*)::int n, SUM(amount_cents)::bigint / 100 AS total_zar FROM trust_entries GROUP BY entry_type ORDER BY entry_type
`)
console.log('\n── Trust entries by type ──')
for (const r of summary) console.log(`  ${r.entry_type.padEnd(22)} ${String(r.n).padStart(5)} rows, R${r.total_zar}`)

// Net trust balance = receipts + transfer_in − payments − transfer_out
const net = (await q(`
  SELECT
    COALESCE(SUM(CASE WHEN entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN amount_cents ELSE 0 END), 0) AS inflows,
    COALESCE(SUM(CASE WHEN entry_type IN ('trust_payment','trust_transfer_out') THEN amount_cents ELSE 0 END), 0) AS outflows
  FROM trust_entries
`))[0]
const netBalance = (net.inflows - net.outflows) / 100
console.log(`\nNet trust balance: R${netBalance.toFixed(2)}`)
console.log(`LP closing balance (from statement): R474,204.67`)

await client.end()
