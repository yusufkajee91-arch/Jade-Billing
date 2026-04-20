import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/Detailed-Matter-Ledger-for-2021-01-01-to-2026-04-19-T-ZAR-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })

const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id

const toSaDate = (dt) => {
  if (!dt) return null
  if (typeof dt === 'string') {
    // Already YYYY-MM-DD or parseable; return first 10 chars if ISO-like, else reformat
    if (/^\d{4}-\d{2}-\d{2}/.test(dt)) return dt.slice(0, 10)
    const d = new Date(dt)
    if (isNaN(d)) return null
    return new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  if (dt instanceof Date) {
    return new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  return null
}

// Clean out previous trust entries & their journal entries
console.log('Clearing existing trust_entries + related journal entries…')
await q(`DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE trust_entry_id IS NOT NULL)`)
await q(`DELETE FROM journal_entries WHERE trust_entry_id IS NOT NULL`)
await q(`DELETE FROM trust_entries WHERE 1=1`)

// Disable balance trigger
await q(`ALTER TABLE trust_entries DISABLE TRIGGER trg_check_trust_balance`)

// Parse ledger: OPENING rows set current matter; data rows belong to current matter
let currentMatter = null
let currentMatterId = null
let currentMatterCode = null
let inserted = 0, skippedNoMatter = 0

// Extract matter code from OPENING description: "MATTER: … [MATTER_CODE]"
const extractMatterCode = (desc) => {
  const m = (desc ?? '').match(/\[([^\]]+)\]:\s*Opening Balance$/)
  return m?.[1]?.trim()
}

const typeMap = {
  'Trust Receipt': 'trust_receipt',
  'Trust Payment': 'trust_payment',
  // Trust Transfer: +amount in matter ledger = transfer_out (money leaves matter's trust balance for business)
  // (Note: matter ledger shows sign from DEBTORS perspective where receipt makes balance -ve)
  // We flip this for trust_entries which use POSITIVE amount + entry_type sign
}

for (const r of rows) {
  if (r.type === 'OPENING') {
    currentMatterCode = extractMatterCode(r.Description)
    currentMatterId = currentMatterCode ? matters.get(currentMatterCode) : null
    continue
  }
  if (!r.type || r.type === 'CLOSING' || !r.Date) continue

  const amount = Number(r.amount ?? 0)
  const absCents = Math.round(Math.abs(amount) * 100)
  if (absCents === 0) continue

  let entryType = null
  if (r.type === 'Trust Receipt') {
    // In matter ledger, receipt decreases matter's debt (amount is -ve)
    entryType = 'trust_receipt'
  } else if (r.type === 'Trust Payment') {
    // Payment from trust increases matter's debt, amount is +ve
    entryType = 'trust_payment'
  } else if (r.type === 'Trust Transfer') {
    // In matter ledger, +amount = money leaving matter's trust (transfer_out),
    // -amount = money arriving in matter's trust (transfer_in, e.g. paired counterparty)
    entryType = amount > 0 ? 'trust_transfer_out' : 'trust_transfer_in'
  } else if (r.type === 'Journal') {
    // Skip journals for now — they're manual adjustments
    continue
  }
  if (!entryType) continue

  if (!currentMatterId) { skippedNoMatter++; continue }

  await q(
    `INSERT INTO trust_entries (id, matter_id, entry_type, entry_date, amount_cents, narration, reference_number, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2::"TrustEntryType", $3, $4, $5, $6, $7, NOW(), NOW())`,
    [currentMatterId, entryType, toSaDate(r.Date), absCents, r.Description ?? '', r.reference ?? null, lpImportId]
  )
  inserted++
}

// Re-enable balance trigger
await q(`ALTER TABLE trust_entries ENABLE TRIGGER trg_check_trust_balance`)

console.log(`\ninserted: ${inserted}, skipped (no matter): ${skippedNoMatter}`)

// Summary
const sum = await q(`
  SELECT entry_type::text, COUNT(*)::int n, SUM(amount_cents)::bigint / 100 AS total
  FROM trust_entries GROUP BY entry_type ORDER BY entry_type
`)
console.log('\n── Trust entries by type ──')
for (const r of sum) console.log(`  ${r.entry_type.padEnd(22)} ${String(r.n).padStart(5)}, R${r.total}`)

// Negative balance check
const neg = await q(`
  SELECT m.matter_code, SUM(
    CASE WHEN entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN amount_cents
         WHEN entry_type IN ('trust_payment','trust_transfer_out') THEN -amount_cents
         ELSE 0 END) / 100.0 AS balance
  FROM trust_entries te JOIN matters m ON m.id = te.matter_id
  GROUP BY m.matter_code
  HAVING SUM(CASE WHEN entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN amount_cents
              WHEN entry_type IN ('trust_payment','trust_transfer_out') THEN -amount_cents ELSE 0 END) < 0
  ORDER BY balance LIMIT 15
`)
if (neg.length) {
  console.log(`\n⚠️  ${neg.length} matters with negative trust balance:`)
  for (const r of neg) console.log(`  ${r.matter_code.padEnd(22)} R${Number(r.balance).toFixed(2)}`)
}

// Total trust balance (net inflows - outflows across all matters)
const totalBalance = (await q(`
  SELECT SUM(CASE WHEN entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN amount_cents
               WHEN entry_type IN ('trust_payment','trust_transfer_out') THEN -amount_cents
               ELSE 0 END)::bigint / 100.0 AS net
  FROM trust_entries
`))[0].net
console.log(`\nTotal net trust balance: R${Number(totalBalance).toFixed(2)}`)
console.log(`LP closing balance:      R474,204.67`)

await client.end()
