/**
 * One-time script to import updated fee data from the 13 April 2026 Excel files.
 * - Deduplicates against existing historical entries
 * - Handles both Unbilled Fees and Invoiced Fees file formats
 * - Maps fee earners to correct user profiles
 */
import XLSX from 'xlsx'
import pg from 'pg'
import { fileURLToPath } from 'url'

const { Client } = pg

const UNBILLED_PATH = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/13 April Updated Data/26.04.13 Unbilled Fees (Rand).xlsx'
const INVOICED_PATH = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/13 April Updated Data/26.04.13 Invoiced Fees (Rand).xlsx'

const DISBURSEMENT_ACTIVITIES = [
  'travelling costs', 'copies', 'courier', 'parking', 'accommodation',
  'sheriff', 'advocate', 'cost consultant', 'travel cost', 'phone call: cost'
]

function toDate(val) {
  if (!val) return new Date()
  if (val instanceof Date) return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()))
  if (typeof val === 'number') {
    const MS_PER_DAY = 86400000
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
    return new Date(EXCEL_EPOCH + val * MS_PER_DAY)
  }
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? new Date() : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

function toCents(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function dedupKey(feeEarnerName, matterCode, dateStr, narration, totalCents) {
  return [
    feeEarnerName || '',
    matterCode || '',
    dateStr || '',
    (narration || '').trim().toLowerCase().substring(0, 60),
    totalCents
  ].join('|')
}

function matchFeeEarner(rawName, users, fallbackId) {
  if (!rawName || rawName.trim() === '') return fallbackId
  const name = rawName.trim()
  if (name.toLowerCase() === 'system') {
    return users.find(u => u.role === 'admin')?.id ?? fallbackId
  }
  const nameLower = name.toLowerCase()
  const usersWithFull = users.map(u => ({
    ...u,
    fullName: `${u.first_name} ${u.last_name}`.toLowerCase(),
  }))
  const exact = usersWithFull.find(u => u.fullName === nameLower)
  if (exact) return exact.id
  const words = nameLower.split(/[\s\-]+/).filter(w => w.length > 0)
  const firstName = words[0]
  if (firstName && firstName.length > 2) {
    const match = usersWithFull.find(u => u.fullName.includes(firstName))
    if (match) return match.id
  }
  for (const word of words) {
    if (word.length <= 2) continue
    const match = usersWithFull.find(u => u.fullName.includes(word))
    if (match) return match.id
  }
  return fallbackId
}

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.qtbfotbesidxtnajpfll:CXnbvAVD27aNqSQU@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()
  console.log('Connected to database')

  // ── Load lookup data ──────────────────────────────────────────────────
  const { rows: matters } = await client.query('SELECT id, matter_code FROM matters')
  const matterMap = new Map()
  matters.forEach(m => {
    matterMap.set(m.matter_code, m.id)
    matterMap.set(m.matter_code.replace(/\s/g, ''), m.id)
  })
  console.log(`Loaded ${matters.length} matters`)

  const { rows: users } = await client.query(
    "SELECT id, first_name, last_name, role FROM users WHERE is_active = true"
  )
  const adminUser = users.find(u => u.role === 'admin')
  const fallbackUserId = adminUser?.id ?? users[0]?.id
  console.log(`Loaded ${users.length} users, fallback: ${adminUser?.first_name} ${adminUser?.last_name}`)

  const { rows: postingCodes } = await client.query(
    "SELECT id, code FROM posting_codes WHERE is_active = true"
  )
  const postingCodeMap = new Map(postingCodes.map(p => [p.code, p.id]))
  console.log(`Loaded ${postingCodes.length} posting codes`)

  // ── Load existing entries for dedup ────────────────────────────────────
  const { rows: existing } = await client.query(`
    SELECT fe.fee_earner_name, m.matter_code, fe.entry_date::text AS entry_date,
           LEFT(fe.narration, 80) AS narration, fe.total_cents
    FROM fee_entries fe
    JOIN matters m ON m.id = fe.matter_id
    WHERE fe.is_historical = true
  `)
  const existingKeys = new Set()
  existing.forEach(r => {
    existingKeys.add(dedupKey(r.fee_earner_name, r.matter_code, r.entry_date, r.narration, r.total_cents))
    existingKeys.add(dedupKey(r.fee_earner_name, r.matter_code.replace(/\s/g, ''), r.entry_date, r.narration, r.total_cents))
  })
  console.log(`Loaded ${existing.length} existing entries, ${existingKeys.size} dedup keys\n`)

  // Track stats
  const stats = { unbilledNew: 0, unbilledDup: 0, invoicedNew: 0, invoicedDup: 0, skippedNoMatter: [], errors: [] }

  // ── Process Unbilled Fees ─────────────────────────────────────────────
  console.log('=== IMPORTING UNBILLED FEES ===')
  const wb1 = XLSX.readFile(UNBILLED_PATH, { cellDates: true })
  const unbilledRows = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]])
    .filter(r => r['Fee Earner'] && r['Matter Code'])

  for (let i = 0; i < unbilledRows.length; i++) {
    const row = unbilledRows[i]
    try {
      const matterCode = (row['Matter Code'] || '').replace(/\s/g, '')
      const matterId = matterMap.get(matterCode)
      if (!matterId) {
        if (!stats.skippedNoMatter.includes(matterCode)) stats.skippedNoMatter.push(matterCode)
        continue
      }

      const entryDate = toDate(row['Date'])
      const dateStr = entryDate.toISOString().split('T')[0]
      const narration = (row['Narration'] || `Imported unbilled row ${i + 2}`).trim()
      const amountCents = toCents(row['amount'])
      const rawFeeEarner = (row['Fee Earner'] || '').trim()

      // Dedup check
      const key = dedupKey(rawFeeEarner, matterCode, dateStr, narration, amountCents)
      if (existingKeys.has(key)) { stats.unbilledDup++; continue }

      // Determine entry type
      const account = (row['Account'] || '').toUpperCase()
      const minutes = Number(row['Minutes'] || 0)
      let entryType = 'unitary'
      if (account.includes('DISBURSEMENT')) entryType = 'disbursement'
      else if (minutes > 0) entryType = 'time'

      const qty = Number(row['Qty'] || 0)
      const unitPriceCents = toCents(row['Unit Price'])
      const feeEarnerId = matchFeeEarner(rawFeeEarner, users, fallbackUserId)
      const postingCodeStr = (row['Posting Code'] || '').trim()
      const postingCodeId = postingCodeStr ? (postingCodeMap.get(postingCodeStr) ?? null) : null

      await client.query(`
        INSERT INTO fee_entries (
          id, matter_id, entry_type, entry_date, narration, fee_earner_name,
          duration_minutes_raw, duration_minutes_billed,
          unit_quantity_thousandths, rate_cents, amount_cents, total_cents,
          discount_pct, discount_cents,
          is_billable, is_invoiced, posting_code_id,
          fee_earner_id, created_by_id, is_historical, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          0, 0,
          true, false, $12,
          $13, $14, true, NOW(), NOW()
        )
      `, [
        matterId, entryType, dateStr, narration, rawFeeEarner,
        minutes > 0 ? Math.round(minutes) : null,
        minutes > 0 ? Math.round(minutes) : null,
        qty ? Math.round(qty * 1000) : null,
        unitPriceCents, amountCents, amountCents,
        postingCodeId,
        feeEarnerId, fallbackUserId
      ])

      stats.unbilledNew++
      existingKeys.add(key)
    } catch (err) {
      stats.errors.push(`Unbilled row ${i + 2}: ${err.message}`)
    }
  }
  console.log(`  Imported: ${stats.unbilledNew}, Skipped (dup): ${stats.unbilledDup}`)

  // ── Process Invoiced Fees ─────────────────────────────────────────────
  console.log('\n=== IMPORTING INVOICED FEES ===')
  const wb2raw = XLSX.readFile(INVOICED_PATH, { cellDates: false })
  const invoicedRowsRaw = XLSX.utils.sheet_to_json(wb2raw.Sheets[wb2raw.SheetNames[0]])
    .filter(r => r['Fee Earner'] && r['Matter Code'])

  const wb2 = XLSX.readFile(INVOICED_PATH, { cellDates: true })
  const invoicedRows = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]])
    .filter(r => r['Fee Earner'] && r['Matter Code'])

  for (let i = 0; i < invoicedRows.length; i++) {
    const row = invoicedRows[i]
    const rowRaw = invoicedRowsRaw[i]
    try {
      const matterCode = (row['Matter Code'] || '').replace(/\s/g, '')
      const matterId = matterMap.get(matterCode)
      if (!matterId) {
        if (!stats.skippedNoMatter.includes(matterCode)) stats.skippedNoMatter.push(matterCode)
        continue
      }

      const entryDate = toDate(row['Date'])
      const dateStr = entryDate.toISOString().split('T')[0]
      const narration = (row['Narration'] || `Imported invoiced row ${i + 2}`).trim()
      const rawFeeEarner = (row['Fee Earner'] || '').trim()

      // Determine amount and status from the amount columns
      const invoicedAmt = Number(row['Invoiced'] || 0)
      const creditedAmt = Number(row['Credited'] || 0)
      const draftAmt = Number(row['Draft'] || 0)
      const unbillableAmt = Number(row['Unbillable'] || 0)

      let amount, isInvoiced, isBillable
      if (invoicedAmt > 0) {
        amount = invoicedAmt; isInvoiced = true; isBillable = true
      } else if (draftAmt > 0) {
        amount = draftAmt; isInvoiced = false; isBillable = true
      } else if (unbillableAmt > 0) {
        amount = unbillableAmt; isInvoiced = false; isBillable = false
      } else if (creditedAmt < 0) {
        amount = Math.abs(creditedAmt); isInvoiced = true; isBillable = true
      } else {
        amount = 0; isInvoiced = false; isBillable = true
      }

      const amountCents = Math.round(amount * 100)

      // Dedup check
      const key = dedupKey(rawFeeEarner, matterCode, dateStr, narration, amountCents)
      if (existingKeys.has(key)) { stats.invoicedDup++; continue }

      // Determine entry type from Time column and Activity
      const rawTime = Number(rowRaw?.['Time'] || 0)
      const activity = (row['Activity'] || '').toLowerCase()
      let entryType = 'unitary'
      let minutes = null

      if (rawTime > 0) {
        entryType = 'time'
        minutes = Math.round(rawTime * 24 * 60)
        if (minutes < 1) minutes = 1
      } else if (DISBURSEMENT_ACTIVITIES.some(a => activity.includes(a))) {
        entryType = 'disbursement'
      }

      // Calculate rate for time entries
      let rateCents = amountCents
      if (entryType === 'time' && minutes > 0) {
        rateCents = Math.round(amountCents / (minutes / 60))
      }

      const feeEarnerId = matchFeeEarner(rawFeeEarner, users, fallbackUserId)

      await client.query(`
        INSERT INTO fee_entries (
          id, matter_id, entry_type, entry_date, narration, fee_earner_name,
          duration_minutes_raw, duration_minutes_billed,
          unit_quantity_thousandths, rate_cents, amount_cents, total_cents,
          discount_pct, discount_cents,
          is_billable, is_invoiced, posting_code_id,
          fee_earner_id, created_by_id, is_historical, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          0, 0,
          $12, $13, NULL,
          $14, $15, true, NOW(), NOW()
        )
      `, [
        matterId, entryType, dateStr, narration, rawFeeEarner,
        minutes, minutes,
        entryType === 'unitary' ? 1000 : null,
        rateCents, amountCents, amountCents,
        isBillable, isInvoiced,
        feeEarnerId, fallbackUserId
      ])

      stats.invoicedNew++
      existingKeys.add(key)
    } catch (err) {
      stats.errors.push(`Invoiced row ${i + 2}: ${err.message}`)
    }
  }
  console.log(`  Imported: ${stats.invoicedNew}, Skipped (dup): ${stats.invoicedDup}`)

  // ── Final report ──────────────────────────────────────────────────────
  console.log('\n=== IMPORT SUMMARY ===')
  console.log(`Unbilled: ${stats.unbilledNew} imported, ${stats.unbilledDup} duplicates skipped`)
  console.log(`Invoiced: ${stats.invoicedNew} imported, ${stats.invoicedDup} duplicates skipped`)
  console.log(`Total new entries: ${stats.unbilledNew + stats.invoicedNew}`)
  if (stats.skippedNoMatter.length > 0) {
    console.log(`Skipped matter codes (not in DB): ${stats.skippedNoMatter.join(', ')}`)
  }
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    stats.errors.forEach(e => console.log(`  ${e}`))
  }

  // Verify final totals
  const { rows: totals } = await client.query(`
    SELECT u.first_name || ' ' || u.last_name AS user_name, u.initials,
           COUNT(fe.id) AS entries, COALESCE(SUM(fe.total_cents)/100.0, 0) AS total_rands
    FROM users u
    LEFT JOIN fee_entries fe ON fe.fee_earner_id = u.id
    GROUP BY u.id, u.first_name, u.last_name, u.initials
    ORDER BY total_rands DESC
  `)
  console.log('\n=== FINAL DATABASE TOTALS ===')
  totals.forEach(r => {
    console.log(`  ${r.user_name} (${r.initials}): ${r.entries} entries, R${Number(r.total_rands).toFixed(2)}`)
  })

  await client.end()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
