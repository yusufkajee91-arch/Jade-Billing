import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

// ─── 1. Find + fix the 3 matters LP exported without an owner ────────────────
const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/List_matter.xlsx')
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
const orphanCodes = rows.filter(r => !r.owner_salesagent_name).map(r => r.matter_code)
console.log(`LP matters without owner: ${orphanCodes.length}`)
orphanCodes.forEach(c => console.log(`  ${c}`))

// Check if these exist in Casey — if yes (from pre-LP import), preserve Casey's owner.
// If not, assign to Jessica-Jayde (default primary).
const jessica = (await q(`SELECT id FROM users WHERE email='Jess@dcco.law'`))[0]
if (!jessica) throw new Error('Jessica user missing')

for (const code of orphanCodes) {
  const existing = (await q(`SELECT id, owner_id FROM matters WHERE matter_code = $1`, [code]))[0]
  if (existing) {
    console.log(`  ${code} already in Casey with owner_id=${existing.owner_id} — leaving as-is`)
    continue
  }
  // Not in Casey — need to insert. Look up client.
  const lpRow = rows.find(r => r.matter_code === code)
  const customerId = lpRow.customer_id
  const lpClients = XLSX.utils.sheet_to_json(XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/List_customer.xlsx').Sheets['List of customer'])
  const lpCust = lpClients.find(c => c.customer_id === customerId)
  if (!lpCust) { console.log(`  ${code} — no LP customer match, skipping`); continue }
  const caseyClient = (await q(`SELECT id FROM clients WHERE client_code = $1`, [lpCust.customer_code.trim()]))[0]
  if (!caseyClient) { console.log(`  ${code} — client ${lpCust.customer_code} not in Casey, skipping`); continue }
  const lpImport = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0]
  const defaultDept = (await q(`SELECT id FROM departments WHERE name='Default'`))[0]
  await q(
    `INSERT INTO matters (id, matter_code, client_id, description, department_id, owner_id, status, date_opened, created_by, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'open', COALESCE($6::timestamp, NOW()), $7, NOW(), NOW())`,
    [code, caseyClient.id, (lpRow.matter_name || code).trim(), defaultDept.id, jessica.id,
     lpRow.dateopened && lpRow.dateopened !== '1970-01-01' ? lpRow.dateopened : null, lpImport.id]
  )
  console.log(`  ${code} — INSERTED owner=Jessica (LP had no owner)`)
}

// ─── 2. Re-infer department for ALL matters ──────────────────────────────────
// Respect Casey's Default/richer dept for pre-existing-in-Casey matters, but
// override Default if description strongly matches another dept.
const allDepts = await q(`SELECT id, name FROM departments`)
const deptByName = (n) => allDepts.find(d => d.name === n)
const defDeptId = deptByName('Default')?.id

const inferDept = (description) => {
  const d = (description ?? '').toLowerCase()
  if (/trade ?mark|trademark|\bip\b|intellectual property|patent|copyright|cipc/.test(d)) return 'Commercial'
  if (/conveyanc|\btransfer\b|mortgage|sectional title|sale of (?:immovable )?property|\bbond\b/.test(d)) return 'Conveyancing'
  if (/divorce|custody|matrimonial|maintenance|family|minor child|bcea[a-z]?|ccma/.test(d)) return 'Litigation'
  if (/litig|high court|magistrate|\bappeal\b|\bhearing\b|summons|pleadings|case no|application/.test(d)) return 'Litigation'
  return 'Default'
}

// Only update where department is currently Default (preserve any richer Casey classification)
const mattersToInfer = await q(`SELECT id, matter_code, description, department_id FROM matters WHERE department_id = $1`, [defDeptId])
console.log(`\nRe-inferring dept for ${mattersToInfer.length} matters currently tagged 'Default'…`)
let changed = { Commercial: 0, Conveyancing: 0, Litigation: 0, Default: 0 }
for (const m of mattersToInfer) {
  const inferred = inferDept(m.description)
  changed[inferred]++
  if (inferred === 'Default') continue // no-op
  const targetDept = deptByName(inferred)
  await q(`UPDATE matters SET department_id = $1 WHERE id = $2`, [targetDept.id, m.id])
}
console.log('Dept redistribution from Default:')
for (const [k, v] of Object.entries(changed)) console.log(`  → ${k.padEnd(14)} ${v}`)

// ─── 3. Final department distribution ────────────────────────────────────────
const finalDepts = await q(`SELECT d.name, COUNT(m.id)::int AS n FROM departments d LEFT JOIN matters m ON m.department_id=d.id GROUP BY d.name ORDER BY n DESC`)
console.log('\n── Final matter distribution ──')
for (const d of finalDepts) console.log(`  ${d.name.padEnd(15)} ${d.n}`)

const totalMatters = (await q(`SELECT COUNT(*)::int AS n FROM matters`))[0].n
const orphanStill = (await q(`SELECT COUNT(*)::int AS n FROM matters WHERE owner_id IS NULL`))[0].n
console.log(`\ntotal matters: ${totalMatters}, orphaned owner: ${orphanStill}`)

await client.end()
