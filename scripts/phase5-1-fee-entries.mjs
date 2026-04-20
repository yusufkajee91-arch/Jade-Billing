import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/Export-WIP-History-between-2021-01-01-and-2026-04-19-incl-.xlsx', { cellDates: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
console.log(`WIP rows: ${rows.length}`)

// Pre-load lookup tables
const matters = new Map((await q(`SELECT id, matter_code FROM matters`)).map(r => [r.matter_code, r.id]))
const postingCodes = new Map((await q(`SELECT id, code FROM posting_codes`)).map(r => [r.code, r.id]))
const users = await q(`SELECT id, email, first_name, last_name FROM users`)
// Explicit LP-name → Casey-email map (documented in Documentation/Recon/lp-user-mapping.md)
const LP_NAME_ALIASES = {
  'jessica-jayde dolata': 'Jess@dcco.law',
  'jessica dolata':       'Jess@dcco.law',
  'laken-ash':            'associate@dcco.law',
  'laken ash':            'associate@dcco.law',
  'gisele mans':          'gisele@dcco.law',
  'maxine clement':       'maxine@dcco.law',
  'chris geale':          'lp-import@dcco.law', // LP vendor → LP Import user
  'shaan stander':        'lp-import@dcco.law', // external → LP Import user
  'system':               'lp-import@dcco.law',
  'assistant':            'info@dcco.law',
}
const userByName = (name) => {
  if (!name) return null
  const n = name.trim().toLowerCase()
  // Alias map first
  const aliasEmail = LP_NAME_ALIASES[n]
  if (aliasEmail) return users.find(u => u.email === aliasEmail)
  // Fallback: try full or hyphenated match against Casey data
  return users.find(u => {
    const full = `${u.first_name} ${u.last_name}`.toLowerCase().trim()
    const hyphenated = `${u.first_name}-${u.last_name}`.toLowerCase().trim()
    return n === full || n === hyphenated || n.replace(/-/g, ' ') === full
  })
}
const lpImportId = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0].id

// Pre-count current historical fee entries
const beforeCount = await q(`
  SELECT 'total' AS k, COUNT(*)::int AS n FROM fee_entries
  UNION ALL SELECT 'historical', COUNT(*) FROM fee_entries WHERE is_historical = true
  UNION ALL SELECT 'non-historical', COUNT(*) FROM fee_entries WHERE is_historical = false
`)
console.log('Before:')
for (const r of beforeCount) console.log(`  ${r.k.padEnd(16)} ${r.n}`)

// Truncate historical fee entries (preserves the 8 is_historical=false entries)
const del = await q(`DELETE FROM fee_entries WHERE is_historical = true RETURNING id`)
console.log(`Deleted ${del.length} historical fee_entries`)

// Convert Excel date (stored as JS Date by xlsx when cellDates=true) → SAST date string
// The timestamp represents UTC, but LP's intent is SA local date. Apply +2h offset.
const toSaDate = (dt) => {
  if (!(dt instanceof Date)) return null
  const sa = new Date(dt.getTime() + 2 * 60 * 60 * 1000)
  return sa.toISOString().slice(0, 10)
}

// Batch insert config
const BATCH = 200
const valid = []
let skipped = { noMatter: 0, noEarner: 0, noDate: 0, nullRow: 0 }

for (const r of rows) {
  if (!r['Matter Code'] || !r['Date']) { skipped.nullRow++; continue }
  const matterId = matters.get(r['Matter Code'])
  if (!matterId) { skipped.noMatter++; continue }
  const earner = userByName(r['Fee Earner'])
  if (!earner) { skipped.noEarner++; continue }
  const entryDate = toSaDate(r['Date'])
  if (!entryDate) { skipped.noDate++; continue }

  const postingId = postingCodes.get(r['Posting Code']) ?? null
  const minutes = r['Minutes'] ? Math.round(Number(r['Minutes'])) : null
  const qty = r['Qty'] ? Math.round(Number(r['Qty']) * 1000) : null
  const rateCents = Math.round(Number(r['Rate'] ?? 0) * 100)
  const amountExVat = Number(r['Amount (ex VAT)'] ?? r['Amount'] ?? 0)
  const amountCents = Math.round(amountExVat * 100)
  // For historical rows, total = amount (no discount applied in LP)
  const totalCents = amountCents

  // Determine entry type
  let entryType
  if (r['Type'] === 'Disbursements') entryType = 'disbursement'
  else if (minutes && minutes > 0) entryType = 'time'
  else entryType = 'unitary'

  const vatFlag = r['VAT Flag'] === 'Y' ? 'Y' : 'N'
  const isInvoiced = r['Status'] === 'Billed'
  const narration = (r['Narration'] ?? '').toString()

  valid.push({
    matterId, entryType, entryDate, narration,
    durationMinutesRaw: minutes, durationMinutesBilled: minutes,
    unitQuantityThousandths: entryType !== 'time' ? qty : null,
    rateCents, amountCents, totalCents,
    isInvoiced, postingId,
    feeEarnerId: earner.id, feeEarnerName: r['Fee Earner'],
    createdById: lpImportId, capturerId: lpImportId,
    vatFlag,
  })
}

console.log(`Valid: ${valid.length}, Skipped: ${JSON.stringify(skipped)}`)

// Batch insert
let inserted = 0
for (let i = 0; i < valid.length; i += BATCH) {
  const batch = valid.slice(i, i + BATCH)
  const placeholders = []
  const values = []
  let p = 1
  for (const v of batch) {
    placeholders.push(`(gen_random_uuid()::text, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 0, 0, $${p++}, true, $${p++}, NULL, NULL, $${p++}, $${p++}, $${p++}, $${p++}, true, $${p++}, $${p++}, $${p++}, NOW(), NOW())`)
    values.push(
      v.matterId, v.entryType, v.entryDate, v.narration,
      v.durationMinutesRaw, v.durationMinutesBilled, v.unitQuantityThousandths,
      v.rateCents, v.amountCents, v.totalCents, v.isInvoiced,
      v.postingId, v.feeEarnerId, v.createdById, v.capturerId,
      v.feeEarnerName, v.vatFlag, v.entryDate
    )
  }
  const sql = `
    INSERT INTO fee_entries (
      id, matter_id, entry_type, entry_date, narration,
      duration_minutes_raw, duration_minutes_billed, unit_quantity_thousandths,
      rate_cents, amount_cents, discount_pct, discount_cents, total_cents,
      is_billable, is_invoiced, receipt_file_name, receipt_file_path,
      posting_code_id, fee_earner_id, created_by_id, capturer_id,
      is_historical, fee_earner_name, vat_flag, stamp_date,
      created_at, updated_at
    ) VALUES ${placeholders.join(', ')}
  `
  await q(sql, values)
  inserted += batch.length
  if (i % (BATCH * 5) === 0) console.log(`  inserted ${inserted}/${valid.length}`)
}
console.log(`Total inserted: ${inserted}`)

// Final verification
const after = await q(`
  SELECT 'total' AS k, COUNT(*)::int AS n FROM fee_entries
  UNION ALL SELECT 'historical', COUNT(*) FROM fee_entries WHERE is_historical = true
  UNION ALL SELECT 'non-historical', COUNT(*) FROM fee_entries WHERE is_historical = false
  UNION ALL SELECT 'billed', COUNT(*) FROM fee_entries WHERE is_invoiced = true
  UNION ALL SELECT 'draft', COUNT(*) FROM fee_entries WHERE is_invoiced = false
  UNION ALL SELECT 'time entries', COUNT(*) FROM fee_entries WHERE entry_type = 'time'
  UNION ALL SELECT 'unitary entries', COUNT(*) FROM fee_entries WHERE entry_type = 'unitary'
  UNION ALL SELECT 'disbursement entries', COUNT(*) FROM fee_entries WHERE entry_type = 'disbursement'
`)
console.log('\n── Phase 5.1 summary ──')
for (const r of after) console.log(`  ${r.k.padEnd(22)} ${r.n}`)

// Check total amount vs LP
const caseyTotal = (await q(`SELECT SUM(total_cents)::bigint AS sum FROM fee_entries WHERE is_historical = true`))[0].sum
const lpTotal = rows.reduce((s, r) => s + Number(r['Amount (ex VAT)'] ?? r['Amount'] ?? 0), 0)
console.log(`\nTotal amount (ex VAT):`)
console.log(`  LP source:      R${lpTotal.toFixed(2)}`)
console.log(`  Casey imported: R${(caseyTotal / 100).toFixed(2)}`)
console.log(`  Delta:          R${(lpTotal - caseyTotal / 100).toFixed(2)}`)

await client.end()
