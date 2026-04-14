/**
 * Verify DB monthly totals match LP inception file exactly.
 * Compares: DB billable non-disbursement totals vs LP (Invoiced + Draft) totals.
 *
 * Run: cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/verify-lp-match.mjs
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

async function main() {
  // ── Read LP file and compute expected totals ──────────────────────────
  const wb = XLSX.readFile(LP_PATH, { cellDates: true })
  const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  // Read raw for Time column
  const wbRaw = XLSX.readFile(LP_PATH, { cellDates: false })
  const allRowsRaw = XLSX.utils.sheet_to_json(wbRaw.Sheets[wbRaw.SheetNames[0]])

  // No skipped matters — all now exist in DB
  const SKIPPED_MATTERS = new Set()

  const lpMonthly = {}
  const lpMonthlyAll = {} // including skipped matters
  let lpTotal = 0
  let lpTotalAll = 0
  let skippedMatterAmount = 0

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    const rowRaw = allRowsRaw[i]

    if (!row['Date'] || !row['Fee Earner'] || !row['Matter Code']) continue

    const matterCode = (row['Matter Code'] || '').toString().replace(/\s/g, '')
    const entryDate = toDate(row['Date'])
    if (!entryDate) continue

    const invoicedAmt = Number(row['Invoiced'] || 0)
    const creditedAmt = Number(row['Credited'] || 0)
    const draftAmt = Number(row['Draft'] || 0)
    const unbillableAmt = Number(row['Unbillable'] || 0)

    let amount, isBillable
    if (invoicedAmt > 0) {
      amount = invoicedAmt; isBillable = true
    } else if (draftAmt > 0) {
      amount = draftAmt; isBillable = true
    } else if (unbillableAmt > 0) {
      amount = unbillableAmt; isBillable = false
    } else if (creditedAmt < 0) {
      amount = Math.abs(creditedAmt); isBillable = true
    } else if (invoicedAmt === 0 && draftAmt === 0 && unbillableAmt === 0 && creditedAmt === 0) {
      continue // zero amount
    } else {
      amount = 0; isBillable = true
    }

    // Determine entry type
    const rawTime = Number(rowRaw?.['Time'] || 0)
    const activity = (row['Activity'] || '').toLowerCase()
    let isDisbursement = false
    if (rawTime <= 0 && DISBURSEMENT_ACTIVITIES.some(a => activity.includes(a))) {
      isDisbursement = true
    }

    // Only count billable non-disbursement (matches chart filter)
    if (!isBillable || isDisbursement) continue

    const amountCents = Math.round(amount * 100)
    const month = entryDate.toISOString().split('T')[0].substring(0, 7)

    if (!lpMonthlyAll[month]) lpMonthlyAll[month] = 0
    lpMonthlyAll[month] += amountCents
    lpTotalAll += amountCents

    if (SKIPPED_MATTERS.has(matterCode)) {
      skippedMatterAmount += amountCents
      continue
    }

    if (!lpMonthly[month]) lpMonthly[month] = 0
    lpMonthly[month] += amountCents
    lpTotal += amountCents
  }

  console.log(`LP billable non-disbursement total (all matters): R${(lpTotalAll / 100).toFixed(2)}`)
  console.log(`LP billable non-disbursement total (DB matters only): R${(lpTotal / 100).toFixed(2)}`)
  console.log(`Skipped matter entries amount: R${(skippedMatterAmount / 100).toFixed(2)}\n`)

  // ── Query DB ──────────────────────────────────────────────────────────
  const client = new Client({
    connectionString: 'postgresql://postgres.qtbfotbesidxtnajpfll:CXnbvAVD27aNqSQU@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()

  const { rows: dbRows } = await client.query(`
    SELECT TO_CHAR(entry_date, 'YYYY-MM') AS month,
           SUM(total_cents) AS total_cents
    FROM fee_entries
    WHERE is_historical = true
      AND is_billable = true
      AND entry_type != 'disbursement'
    GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
    ORDER BY month
  `)

  const dbMonthly = {}
  let dbTotal = 0
  dbRows.forEach(r => {
    dbMonthly[r.month] = Number(r.total_cents)
    dbTotal += Number(r.total_cents)
  })

  // ── Compare ───────────────────────────────────────────────────────────
  const allMonths = new Set([...Object.keys(lpMonthly), ...Object.keys(dbMonthly)])
  const months = [...allMonths].sort()

  console.log('Month        | LP (DB matters) |       DB       |     Gap')
  console.log('-------------|-----------------|----------------|----------')

  let totalGap = 0
  let matchCount = 0
  let mismatchCount = 0

  for (const m of months) {
    const lp = lpMonthly[m] || 0
    const db = dbMonthly[m] || 0
    const gap = db - lp
    totalGap += gap
    const status = Math.abs(gap) < 1 ? '  OK' : ' MISMATCH'
    if (Math.abs(gap) < 1) matchCount++
    else mismatchCount++
    console.log(`${m}    | R${(lp / 100).toFixed(2).padStart(12)} | R${(db / 100).toFixed(2).padStart(12)} | R${(gap / 100).toFixed(2).padStart(8)}${status}`)
  }

  console.log('-------------|-----------------|----------------|----------')
  console.log(`TOTAL        | R${(lpTotal / 100).toFixed(2).padStart(12)} | R${(dbTotal / 100).toFixed(2).padStart(12)} | R${(totalGap / 100).toFixed(2).padStart(8)}`)
  console.log(`\nMonths matching: ${matchCount}/${months.length}, Mismatches: ${mismatchCount}`)

  if (mismatchCount === 0 && Math.abs(totalGap) < 1) {
    console.log('\n✅ PERFECT MATCH — DB exactly matches LP for all importable matters!')
  } else {
    console.log('\n❌ GAPS DETECTED — investigation needed')
  }

  await client.end()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
