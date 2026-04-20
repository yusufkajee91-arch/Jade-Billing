import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/FICA-Report.xlsx')
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
console.log(`FICA-Report: ${rows.length} rows`)

const statusMap = { green: 'compliant', red: 'not_compliant', yellow: 'partially_compliant' }
let updated = 0, noStatus = 0, notFound = 0
for (const r of rows) {
  const code = (r.Code ?? '').trim()
  const lpStatus = r['FICA Status']
  if (!code) continue
  if (!lpStatus) { noStatus++; continue }
  const caseyStatus = statusMap[lpStatus] ?? 'not_compliant'

  // Match Casey client — either by exact code or by short code match
  const exact = (await q(`SELECT id FROM clients WHERE client_code = $1`, [code]))[0]
  const byShort = exact ? null : (await q(`SELECT id FROM clients WHERE client_code LIKE $1 LIMIT 1`, [`%${code}%`]))[0]
  const found = exact ?? byShort
  if (!found) { notFound++; console.log(`  NOT FOUND: ${code}`); continue }
  await q(
    `UPDATE clients SET fica_status = $1, fica_last_updated_at = NOW() WHERE id = $2`,
    [caseyStatus, found.id]
  )
  console.log(`  ${code} → ${caseyStatus}`)
  updated++
}
console.log(`\nFICA: ${updated} updated, ${noStatus} had no status, ${notFound} not found`)

const dist = await q(`SELECT fica_status, COUNT(*)::int AS n FROM clients GROUP BY fica_status ORDER BY n DESC`)
console.log('\nFinal FICA distribution:')
for (const r of dist) console.log(`  ${r.fica_status.padEnd(22)} ${r.n}`)

await client.end()
