import pg from 'pg'
import 'dotenv/config'
const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const depts = new Map((await q(`SELECT id, name FROM departments`)).map(r => [r.name, r.id]))
const defaultId = depts.get('Default')

// Refined rules — order matters: first match wins
const inferDept = (description) => {
  const d = (description ?? '').toLowerCase()
  // Conveyancing — property transfers
  if (/conveyanc|sectional title|sale of (?:immovable )?property|deed of sale|bond cancel|transfer duty|deeds office|cipro/.test(d)) return 'Conveyancing'
  // Commercial — IP, contracts, corporate, regulatory
  if (/trade ?mark|trademark|\bip[ -]|intellectual property|patent|copyright|cipc|brand|advertisement.*name/.test(d)) return 'Commercial'
  if (/agreement|contract|t'?s ?(&|and) ?c'?s|terms ?(&|and) ?conditions|privacy policy|sla\b|nda\b|drafting/.test(d)) return 'Commercial'
  if (/shareholder|director|formation of|incorporation|memorandum of incorporation|moi\b|company secretary/.test(d)) return 'Commercial'
  if (/employment contract|disciplinary procedure|hr ?policy|ppe policy|policy review/.test(d)) return 'Commercial'
  if (/insurance|sla\b|service level|distribution agreement|franchise/.test(d)) return 'Commercial'
  // Litigation — court, party vs party, demands, claims
  if (/\bvs?\b|\/\/| v\.? |\bversus\b/.test(d)) return 'Litigation'
  if (/litig|high court|magistrate|\bappeal\b|\bhearing\b|summons|pleadings|case ?no|\bipo\b|tribunal|ccma|bcea[a-z]?/.test(d)) return 'Litigation'
  if (/divorce|custody|matrimonial|maintenance|family|minor child|protection order/.test(d)) return 'Litigation'
  if (/letter of demand|outstanding fees|claim against|reinstatement|return of (?:residential )?lease deposit|recovery|debt collection/.test(d)) return 'Litigation'
  if (/disciplinary proceeding|disciplinary hearing/.test(d)) return 'Litigation'
  return 'Default'
}

const matters = await q(`SELECT id, matter_code, description FROM matters WHERE department_id = $1`, [defaultId])
console.log(`Re-inferring dept for ${matters.length} matters currently 'Default'…`)
let counts = { Commercial: 0, Conveyancing: 0, Litigation: 0, Default: 0 }
for (const m of matters) {
  const inferred = inferDept(m.description)
  counts[inferred]++
  if (inferred === 'Default') continue
  await q(`UPDATE matters SET department_id = $1 WHERE id = $2`, [depts.get(inferred), m.id])
}
console.log('Reclassified from Default:')
for (const [k, v] of Object.entries(counts)) console.log(`  → ${k.padEnd(14)} ${v}`)

const final = await q(`SELECT d.name, COUNT(m.id)::int AS n FROM departments d LEFT JOIN matters m ON m.department_id=d.id GROUP BY d.name ORDER BY n DESC`)
console.log('\n── Final department distribution ──')
for (const r of final) console.log(`  ${r.name.padEnd(15)} ${r.n}`)

await client.end()
