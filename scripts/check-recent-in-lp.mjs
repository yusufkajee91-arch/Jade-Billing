import XLSX from 'xlsx'
import path from 'path'

const dir = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon'

const caseyMatters = ['JJ/YNV-001', 'JJ/CCH-002', 'JJ/PGS-001', 'JJ/BSR-001', 'JJ/QPH-003', 'LA/KAI-001', 'JJ/ARR-001', 'JJ/MABC-001']
const caseyClients = ['JJ/YNV', 'JJ/PGS', 'KAI', 'ARR', 'MABC']
const caseyUsers = ['Gisele', 'Maxine']

// Check LP matter list
const mWb = XLSX.readFile(path.join(dir, 'List_matter.xlsx'))
const mRows = XLSX.utils.sheet_to_json(mWb.Sheets[mWb.SheetNames[0]])
const lpMatters = new Set(mRows.map(r => r.matter_code))
console.log('=== CASEY MATTERS (last 14d) — in LP?')
for (const mc of caseyMatters) {
  console.log(`  ${mc.padEnd(15)} → ${lpMatters.has(mc) ? '✓ in LP' : '✗ CASEY-ONLY'}`)
}

// Check LP client list
const cWb = XLSX.readFile(path.join(dir, 'List_customer.xlsx'))
const cRows = XLSX.utils.sheet_to_json(cWb.Sheets[cWb.SheetNames[0]])
const lpClientCodes = new Set(cRows.map(r => r.customer_code))
// Client codes in LP have matter-prefix format like MC/TMC4271/1, so compare by partial match too
console.log('\n=== CASEY CLIENTS (last 14d) — in LP?')
for (const cc of caseyClients) {
  const exact = lpClientCodes.has(cc)
  const partial = !exact && [...lpClientCodes].find(lc => lc && lc.startsWith(cc))
  console.log(`  ${cc.padEnd(10)} → ${exact ? '✓ exact in LP' : partial ? `~ partial match (${partial})` : '✗ CASEY-ONLY'}`)
}

// Check LP login list
const lWb = XLSX.readFile(path.join(dir, 'List_login.xlsx'))
const lRows = XLSX.utils.sheet_to_json(lWb.Sheets[lWb.SheetNames[0]])
const lpLogins = new Set(lRows.map(r => r.login_name))
console.log('\n=== CASEY USERS (last 14d) — in LP?')
for (const u of caseyUsers) {
  const match = [...lpLogins].find(ln => ln && ln.toLowerCase().includes(u.toLowerCase()))
  console.log(`  ${u.padEnd(10)} → ${match ? `✓ in LP as "${match}"` : '✗ CASEY-ONLY'}`)
}

// Check LP WIP for any entries on LA/KAI-001
const wWb = XLSX.readFile(path.join(dir, 'Export-WIP-History-between-2021-01-01-and-2026-04-19-incl-.xlsx'))
const wRows = XLSX.utils.sheet_to_json(wWb.Sheets[wWb.SheetNames[0]])
const lpLaKaiEntries = wRows.filter(r => r['Matter Code'] === 'LA/KAI-001')
console.log(`\n=== LP WIP on LA/KAI-001 (Casey has 8 is_historical=false entries on this matter):`)
console.log(`  LP rows: ${lpLaKaiEntries.length}`)
lpLaKaiEntries.slice(0, 20).forEach(r => console.log(`    ${r.Date?.toString().slice(0,10)} | ${r['Posting Code']} | ${r.Amount} | ${(r.Narration || '').slice(0,60)}`))
