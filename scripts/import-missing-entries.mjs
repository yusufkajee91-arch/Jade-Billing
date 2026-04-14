/**
 * Import entries NOT in the inception file:
 * 1. 20 third-party disbursements from the 14-Apr unbilled file
 * 2. 1 missing fee entry (Laken-Ash FIA-002 consultation R1,150)
 *
 * Run AFTER reimport-from-lp.mjs completes.
 * Run: cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/import-missing-entries.mjs
 */
import XLSX from 'xlsx'
import pg from 'pg'

const { Client } = pg

const UNBILLED_PATH = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/14 April Dat update unbilled fees/26.04.14 Unbilled Fees and Disbursments.xlsx'

function toDate(val) {
  if (!val) return null
  if (val instanceof Date) return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()))
  if (typeof val === 'number') {
    return new Date(Date.UTC(1899, 11, 30) + val * 86400000)
  }
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

function toCents(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : Math.round(n * 100)
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

  // Load lookup data
  const { rows: matters } = await client.query('SELECT id, matter_code FROM matters')
  const matterMap = new Map()
  matters.forEach(m => {
    matterMap.set(m.matter_code, m.id)
    matterMap.set(m.matter_code.replace(/\s/g, ''), m.id)
  })

  const { rows: users } = await client.query(
    "SELECT id, first_name, last_name, role FROM users WHERE is_active = true"
  )
  const adminUser = users.find(u => u.role === 'admin')
  const fallbackUserId = adminUser?.id ?? users[0]?.id

  // Build dedup keys from existing entries
  const { rows: existing } = await client.query(`
    SELECT fe.fee_earner_name, m.matter_code, fe.entry_date::text AS entry_date,
           LEFT(fe.narration, 80) AS narration, fe.total_cents
    FROM fee_entries fe
    JOIN matters m ON m.id = fe.matter_id
    WHERE fe.is_historical = true
  `)
  const existingKeys = new Set()
  existing.forEach(r => {
    const key = [
      r.fee_earner_name || '',
      r.matter_code.replace(/\s/g, '') || '',
      r.entry_date || '',
      (r.narration || '').trim().toLowerCase().substring(0, 60),
      r.total_cents
    ].join('|')
    existingKeys.add(key)
  })
  console.log(`Loaded ${existing.length} existing entries for dedup\n`)

  const stats = { disbursements: 0, fees: 0, skippedDup: 0, skippedNoMatter: [], errors: [] }

  // ── Part 1: Import disbursements from unbilled file ───────────────────
  console.log('=== IMPORTING DISBURSEMENTS FROM UNBILLED FILE ===')
  const wb = XLSX.readFile(UNBILLED_PATH, { cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const account = (row['Account'] || '').toUpperCase()
      // Only import UNBILLEDDISBURSEMENTS entries (these are NOT in inception file)
      if (!account.includes('DISBURSEMENT')) continue

      const matterCode = (row['Matter Code'] || '').toString().replace(/\s/g, '')
      const matterId = matterMap.get(matterCode)
      if (!matterId) {
        if (!stats.skippedNoMatter.includes(matterCode)) stats.skippedNoMatter.push(matterCode)
        continue
      }

      const entryDate = toDate(row['Date'])
      if (!entryDate) continue
      const dateStr = entryDate.toISOString().split('T')[0]
      const narration = (row['Narration'] || `Disbursement row ${i + 2}`).trim()
      const amountCents = toCents(row['amount'])
      const rawFeeEarner = (row['Fee Earner'] || '').trim()

      // Dedup check
      const key = [
        rawFeeEarner || '',
        matterCode || '',
        dateStr || '',
        narration.toLowerCase().substring(0, 60),
        amountCents
      ].join('|')
      if (existingKeys.has(key)) { stats.skippedDup++; continue }

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
          gen_random_uuid(), $1, 'disbursement', $2, $3, $4,
          NULL, NULL, NULL, $5, $5, $5,
          0, 0,
          true, false, NULL,
          $6, $7, true, NOW(), NOW()
        )
      `, [matterId, dateStr, narration, rawFeeEarner, amountCents, feeEarnerId, fallbackUserId])

      stats.disbursements++
      existingKeys.add(key)
      console.log(`  ${dateStr} | ${matterCode} | R${(amountCents/100).toFixed(2)} | ${narration.substring(0, 50)}`)
    } catch (err) {
      stats.errors.push(`Disb row ${i + 2}: ${err.message}`)
    }
  }

  // ── Part 2: Import the 1 missing fee entry ────────────────────────────
  console.log('\n=== IMPORTING MISSING FEE ENTRY ===')
  // Laken-Ash FIA-002 consultation R1,150 on 2026-02-24
  // This was in the 13-Apr unbilled file but not in inception
  const fiaCode = 'JJ/FIA-003' // reassigned from FIA-002
  const fiaMatterId = matterMap.get(fiaCode) || matterMap.get('JJ/FIA-003')
  if (fiaMatterId) {
    const missingKey = [
      'Laken-Ash', 'JJ/FIA-003', '2026-02-24',
      'consultation', 115000
    ].join('|')
    // Also check with FIA-002 in case it was imported under old code
    const altKey = [
      'Laken-Ash', 'JJ/FIA-002', '2026-02-24',
      'consultation', 115000
    ].join('|')

    if (existingKeys.has(missingKey) || existingKeys.has(altKey)) {
      console.log('  Already exists (duplicate), skipping')
      stats.skippedDup++
    } else {
      const lakenId = users.find(u => u.first_name?.toLowerCase().includes('laken'))?.id ?? fallbackUserId
      await client.query(`
        INSERT INTO fee_entries (
          id, matter_id, entry_type, entry_date, narration, fee_earner_name,
          duration_minutes_raw, duration_minutes_billed,
          unit_quantity_thousandths, rate_cents, amount_cents, total_cents,
          discount_pct, discount_cents,
          is_billable, is_invoiced, posting_code_id,
          fee_earner_id, created_by_id, is_historical, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, 'time', '2026-02-24', 'Consultation', 'Laken-Ash',
          60, 60, NULL, 115000, 115000, 115000,
          0, 0,
          true, false, NULL,
          $2, $3, true, NOW(), NOW()
        )
      `, [fiaMatterId, lakenId, fallbackUserId])
      stats.fees++
      console.log('  Imported: 2026-02-24 | JJ/FIA-003 | R1,150.00 | Consultation (Laken-Ash)')
    }
  } else {
    console.log('  ERROR: JJ/FIA-003 not found in matters')
    stats.errors.push('Missing matter JJ/FIA-003')
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n=== IMPORT SUMMARY ===')
  console.log(`Disbursements imported: ${stats.disbursements}`)
  console.log(`Fee entries imported: ${stats.fees}`)
  console.log(`Skipped (duplicate): ${stats.skippedDup}`)
  if (stats.skippedNoMatter.length > 0) {
    console.log(`Skipped matter codes: ${stats.skippedNoMatter.join(', ')}`)
  }
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.join('; ')}`)
  }

  await client.end()
  console.log('Done.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
