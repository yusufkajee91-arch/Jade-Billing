import XLSX from 'xlsx'
import path from 'path'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

const wb = XLSX.readFile('/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon/Export-Accounts-as-at-2026-04-19.xlsx')
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

// Aggregate by code (FEES & DISBURSEMENTS have 5 rows each — one per fee earner)
const byCode = {}
for (const r of rows) {
  const c = r['Account Code']; if (!c) continue
  byCode[c] ||= { code: c, name: r['Account Name'], flag: r['flag'], sum: 0 }
  byCode[c].sum += Number(r['balance'] ?? 0)
}

// Flag → account_type (override for the ones LP left blank)
const flagToType = { A: 'asset', L: 'liability', E: 'expense', I: 'income', D: 'asset', C: 'liability' }
// Manual overrides for accounts with no flag in LP export
const manualOverrides = {
  STAFF: 'expense',
  STAFFLOAN: 'asset',
  STAFFDEDUCT: 'liability',
  UIF: 'liability',
  PAYE: 'liability',
  SDL: 'liability',
  RETAINED: 'equity',
  // "O" flag seen in earlier output — directors loans
  MDL: 'equity',
  JDL: 'equity',
}

for (const acc of Object.values(byCode)) {
  const caseyType = manualOverrides[acc.code] ?? flagToType[acc.flag] ?? 'asset'
  const openingCents = Math.round(acc.sum * 100)
  const res = await q(
    `UPDATE gl_accounts SET opening_balance_cents = $1, account_type = $2 WHERE code = $3 RETURNING id, code, name, account_type, opening_balance_cents`,
    [openingCents, caseyType, acc.code]
  )
  if (res.length) {
    console.log(`updated ${acc.code} (${acc.name.trim()}) type=${caseyType} balance=${acc.sum}`)
  } else {
    console.log(`WARN: gl_account ${acc.code} not found — skipping`)
  }
}

// Final state
console.log('\n── GL accounts final state ──')
const final = await q(`SELECT code, name, account_type, opening_balance_cents / 100.0 AS balance, flag FROM gl_accounts ORDER BY account_type, code`)
console.log(`total: ${final.length}`)
for (const r of final) console.log(`  ${r.account_type.padEnd(10)} ${r.code.padEnd(24)} ${String(r.balance).padStart(14)} ${r.name.trim()}`)

// Sanity: total opening balances should be ~0 (debits = credits)
const total = final.reduce((s, r) => s + Number(r.balance), 0)
console.log(`\nTotal opening balance across all accounts: ${total.toFixed(2)} (should be ~0 if LP data is balanced)`)

await client.end()
