/**
 * Re-import ALL historical fee entries from the authoritative LP inception report.
 *
 * Steps:
 * 1. Deletes all existing historical fee entries (is_historical = true)
 * 2. Reads the LP "fees report (from inception)" Excel file
 * 3. Imports each row with correct entry_type, is_billable, is_invoiced
 *
 * Run: cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/reimport-from-lp.mjs
 */
import XLSX from 'xlsx'
import pg from 'pg'

const { Client } = pg

const LP_PATH = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/14 April Dat update unbilled fees/feesreport (from inception).xlsx'

const DISBURSEMENT_ACTIVITIES = [
  'travelling costs', 'copies', 'courier', 'parking', 'accommodation',
  'sheriff', 'advocate', 'cost consultant', 'travel cost', 'phone call: cost',
  'official fees', 'printing', 'postage', 'registration fees'
]

function toDate(val) {
  if (!val) return null
  if (val instanceof Date) return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()))
  if (typeof val === 'number') {
    const MS_PER_DAY = 86400000
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
    return new Date(EXCEL_EPOCH + val * MS_PER_DAY)
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

  // ── Step 1: Delete all historical entries ─────────────────────────────
  const { rowCount: deletedCount } = await client.query(
    "DELETE FROM fee_entries WHERE is_historical = true"
  )
  console.log(`\nDeleted ${deletedCount} historical fee entries`)

  // ── Step 2: Read LP inception file ────────────────────────────────────
  // Read with cellDates: true for proper date handling
  const wb = XLSX.readFile(LP_PATH, { cellDates: true })
  const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  // Also read with cellDates: false to get raw Time values (Excel serial numbers)
  const wbRaw = XLSX.readFile(LP_PATH, { cellDates: false })
  const allRowsRaw = XLSX.utils.sheet_to_json(wbRaw.Sheets[wbRaw.SheetNames[0]])

  console.log(`LP file: ${allRows.length} total rows\n`)

  // ── Step 3: Prepare all rows for batch insert ─────────────────────────
  const stats = {
    imported: 0,
    skippedNoMatter: [],
    skippedNoDate: 0,
    skippedZeroAmount: 0,
    skippedInvalid: 0,
    errors: [],
    byMonth: {},
    byEarner: {}
  }

  const prepared = []

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    const rowRaw = allRowsRaw[i]

    if (!row['Date'] || !row['Fee Earner'] || !row['Matter Code']) {
      stats.skippedInvalid++
      continue
    }
    try {
      const matterCode = (row['Matter Code'] || '').toString().replace(/\s/g, '')
      const matterId = matterMap.get(matterCode)
      if (!matterId) {
        if (!stats.skippedNoMatter.includes(matterCode)) stats.skippedNoMatter.push(matterCode)
        continue
      }

      const entryDate = toDate(row['Date'])
      if (!entryDate) { stats.skippedNoDate++; continue }
      const dateStr = entryDate.toISOString().split('T')[0]

      const narration = (row['Narration'] || `Imported LP row ${i + 2}`).trim()
      const rawFeeEarner = (row['Fee Earner'] || '').trim()

      const invoicedAmt = Number(row['Invoiced'] || 0)
      const creditedAmt = Number(row['Credited'] || 0)
      const draftAmt = Number(row['Draft'] || 0)
      const unbillableAmt = Number(row['Unbillable'] || 0)

      let amount, isBillable, isInvoiced
      if (invoicedAmt > 0) {
        amount = invoicedAmt; isBillable = true; isInvoiced = true
      } else if (draftAmt > 0) {
        amount = draftAmt; isBillable = true; isInvoiced = false
      } else if (unbillableAmt > 0) {
        amount = unbillableAmt; isBillable = false; isInvoiced = false
      } else if (creditedAmt < 0) {
        amount = Math.abs(creditedAmt); isBillable = true; isInvoiced = true
      } else if (invoicedAmt === 0 && draftAmt === 0 && unbillableAmt === 0 && creditedAmt === 0) {
        stats.skippedZeroAmount++
        continue
      } else {
        amount = 0; isBillable = true; isInvoiced = false
      }

      const amountCents = Math.round(amount * 100)

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

      let rateCents = amountCents
      if (entryType === 'time' && minutes > 0) {
        rateCents = Math.round(amountCents / (minutes / 60))
      }

      const feeEarnerId = matchFeeEarner(rawFeeEarner, users, fallbackUserId)

      prepared.push([
        matterId, entryType, dateStr, narration, rawFeeEarner,
        minutes, minutes,
        entryType === 'unitary' ? 1000 : null,
        rateCents, amountCents, amountCents,
        isBillable, isInvoiced,
        feeEarnerId, fallbackUserId
      ])

      // Track by month and earner for verification
      const month = dateStr.substring(0, 7)
      if (!stats.byMonth[month]) stats.byMonth[month] = { total: 0, billableNonDisb: 0 }
      stats.byMonth[month].total += amountCents
      if (isBillable && entryType !== 'disbursement') {
        stats.byMonth[month].billableNonDisb += amountCents
      }

      if (!stats.byEarner[rawFeeEarner]) stats.byEarner[rawFeeEarner] = 0
      if (isBillable && entryType !== 'disbursement') {
        stats.byEarner[rawFeeEarner] += amountCents
      }

    } catch (err) {
      stats.errors.push(`Row ${i + 2}: ${err.message}`)
    }
  }

  console.log(`Prepared ${prepared.length} rows for insert\n`)

  // ── Batch insert (50 rows per statement) ──────────────────────────────
  const BATCH_SIZE = 50
  for (let b = 0; b < prepared.length; b += BATCH_SIZE) {
    const batch = prepared.slice(b, b + BATCH_SIZE)
    const values = []
    const params = []
    let paramIdx = 1

    for (const row of batch) {
      const placeholders = Array.from({ length: 15 }, (_, j) => `$${paramIdx + j}`).join(', ')
      values.push(`(gen_random_uuid(), ${placeholders}, 0, 0, NULL, true, NOW(), NOW())`)
      params.push(...row)
      paramIdx += 15
    }

    await client.query(`
      INSERT INTO fee_entries (
        id, matter_id, entry_type, entry_date, narration, fee_earner_name,
        duration_minutes_raw, duration_minutes_billed,
        unit_quantity_thousandths, rate_cents, amount_cents, total_cents,
        is_billable, is_invoiced,
        fee_earner_id, created_by_id,
        discount_pct, discount_cents,
        posting_code_id, is_historical, created_at, updated_at
      ) VALUES ${values.join(',\n')}
    `, params)

    stats.imported += batch.length
    if ((b + BATCH_SIZE) % 500 < BATCH_SIZE) {
      console.log(`  Inserted ${stats.imported}/${prepared.length} ...`)
    }
  }

  // ── Final report ──────────────────────────────────────────────────────
  console.log('=== IMPORT SUMMARY ===')
  console.log(`Imported: ${stats.imported} entries`)
  console.log(`Skipped (invalid row): ${stats.skippedInvalid}`)
  console.log(`Skipped (no date): ${stats.skippedNoDate}`)
  console.log(`Skipped (zero amount): ${stats.skippedZeroAmount}`)
  if (stats.skippedNoMatter.length > 0) {
    console.log(`Skipped matter codes (not in DB): ${stats.skippedNoMatter.join(', ')}`)
  }
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    stats.errors.slice(0, 20).forEach(e => console.log(`  ${e}`))
    if (stats.errors.length > 20) console.log(`  ... and ${stats.errors.length - 20} more`)
  }

  // Monthly totals (billable non-disbursement = what chart should show)
  console.log('\n=== MONTHLY TOTALS (Billable Non-Disbursement = Chart Target) ===')
  const months = Object.keys(stats.byMonth).sort()
  let grandTotal = 0
  months.forEach(m => {
    const cents = stats.byMonth[m].billableNonDisb
    grandTotal += cents
    console.log(`  ${m}: R${(cents / 100).toFixed(2)}`)
  })
  console.log(`  GRAND TOTAL: R${(grandTotal / 100).toFixed(2)}`)

  // Per-earner totals
  console.log('\n=== PER-EARNER TOTALS (Billable Non-Disbursement) ===')
  Object.keys(stats.byEarner).sort().forEach(e => {
    console.log(`  ${e}: R${(stats.byEarner[e] / 100).toFixed(2)}`)
  })

  await client.end()
  console.log('\nDone.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
