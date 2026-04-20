import XLSX from 'xlsx'
import path from 'path'
import pg from 'pg'
import 'dotenv/config'
import bcrypt from 'bcryptjs'

const { Client } = pg
const RECON_DIR = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows
const log = (phase, msg) => console.log(`[${phase}] ${msg}`)
const readXlsx = (file) => {
  const wb = XLSX.readFile(path.join(RECON_DIR, file))
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
}

// ─── 3.1 Missing users (Assistant + LP Import system user) ───────────────────
const unplaceableHash = await bcrypt.hash('ChangeMe-NotSet-' + Math.random(), 10)
const usersToAdd = [
  { email: 'info@dcco.law', firstName: 'Assistant', lastName: '(shared)', initials: 'AS', role: 'assistant', active: true },
  { email: 'lp-import@dcco.law', firstName: 'LP', lastName: 'Import', initials: 'LP', role: 'admin', active: false },
]
for (const u of usersToAdd) {
  const existing = await q('SELECT id FROM users WHERE email = $1', [u.email])
  if (existing.length) { log('3.1', `user ${u.email} exists — skipping`); continue }
  await q(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, initials, role, is_active, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [u.email, unplaceableHash, u.firstName, u.lastName, u.initials, u.role, u.active]
  )
  log('3.1', `inserted user ${u.email} role=${u.role} active=${u.active}`)
}

const lpImportUser = (await q('SELECT id FROM users WHERE email = $1', ['lp-import@dcco.law']))[0]
if (!lpImportUser) throw new Error('LP Import user missing after insert')
const LP_IMPORT_USER_ID = lpImportUser.id
log('3.1', `LP Import user id = ${LP_IMPORT_USER_ID}`)

// ─── 3.2 Fee Levels (replace Casey's 4 with LP's 8) ──────────────────────────
const lpFeeLevels = readXlsx('List_feelevel (4).xlsx')
  .filter(r => r.feelevel_name)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
log('3.2', `LP has ${lpFeeLevels.length} fee levels: ${lpFeeLevels.map(r => r.feelevel_name).join(', ')}`)

// Insert LP fee levels that don't already exist in Casey (by name)
for (const lv of lpFeeLevels) {
  const existing = await q('SELECT id, sort_order FROM fee_levels WHERE name = $1', [lv.feelevel_name])
  if (existing.length) {
    // Update sort order to match LP
    await q(`UPDATE fee_levels SET sort_order = $1 WHERE id = $2`, [lv.order ?? 0, existing[0].id])
    log('3.2', `fee_level "${lv.feelevel_name}" already exists — updated sort_order to ${lv.order}`)
    continue
  }
  await q(
    `INSERT INTO fee_levels (id, name, hourly_rate_cents, is_active, sort_order, created_at)
     VALUES (gen_random_uuid()::text, $1, 0, true, $2, NOW())`,
    [lv.feelevel_name, lv.order ?? 0]
  )
  log('3.2', `inserted fee_level "${lv.feelevel_name}" sort_order=${lv.order}`)
}

// Remap users from Casey names → LP names
const feeLevelRemap = { Junior: 'Low', Senior: 'High', Partner: 'Subsidised' }
for (const [caseyName, lpName] of Object.entries(feeLevelRemap)) {
  const casey = (await q('SELECT id FROM fee_levels WHERE name = $1', [caseyName]))[0]
  const lp = (await q('SELECT id FROM fee_levels WHERE name = $1', [lpName]))[0]
  if (!casey || !lp) { log('3.2', `remap SKIP: ${caseyName}→${lpName} — one not found`); continue }
  const updated = await q(
    `UPDATE users SET default_fee_level_id = $1 WHERE default_fee_level_id = $2 RETURNING id`,
    [lp.id, casey.id]
  )
  log('3.2', `remapped ${updated.length} user(s): ${caseyName} → ${lpName}`)
}

// Delete Casey's old fee levels that aren't in LP
const caseyOldLevels = ['Junior', 'Senior', 'Partner']
for (const name of caseyOldLevels) {
  const inUse = await q(`SELECT COUNT(*)::int AS n FROM users WHERE default_fee_level_id = (SELECT id FROM fee_levels WHERE name = $1)`, [name])
  if (inUse[0].n > 0) { log('3.2', `fee_level "${name}" still in use by ${inUse[0].n} user(s) — NOT deleting`); continue }
  const res = await q(`DELETE FROM fee_levels WHERE name = $1`, [name])
  log('3.2', `deleted old Casey fee_level "${name}" (${res.rowCount} rows)`)
}

// ─── 3.3 Suppliers ───────────────────────────────────────────────────────────
const lpSuppliers = readXlsx('List_supplier.xlsx')
for (const s of lpSuppliers) {
  const name = (s.supplier_name ?? '').trim()
  const code = (s.supplier_code ?? '').trim() || null
  if (!name) continue
  const existing = code
    ? await q('SELECT id FROM suppliers WHERE supplier_code = $1', [code])
    : await q('SELECT id FROM suppliers WHERE name = $1', [name])
  if (existing.length) { log('3.3', `supplier "${name}" exists — skipping`); continue }
  await q(
    `INSERT INTO suppliers (id, name, supplier_code, is_active, created_by_id, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, true, $3, NOW(), NOW())`,
    [name, code, LP_IMPORT_USER_ID]
  )
  log('3.3', `inserted supplier "${name}" (${code})`)
}

// ─── 3.4 GL Accounts ─────────────────────────────────────────────────────────
const lpGlAccounts = readXlsx('Export-Accounts-as-at-2026-04-19.xlsx')
const flagToType = {
  A: 'asset',
  L: 'liability',
  E: 'expense',
  I: 'income',
  D: 'asset', // Debtors = asset
  C: 'liability', // Creditors = liability
}
for (const row of lpGlAccounts) {
  const code = row['Account Code']
  const name = row['Account Name']
  const flag = row['flag']
  const balance = row['balance'] ?? 0
  if (!code || !name) continue
  const accountType = flagToType[flag] ?? 'asset'
  const openingCents = Math.round(Number(balance) * 100)

  const existing = await q('SELECT id FROM gl_accounts WHERE code = $1', [code])
  if (existing.length) {
    await q(
      `UPDATE gl_accounts SET opening_balance_cents = $1, flag = $2, account_type = $3 WHERE id = $4`,
      [openingCents, flag, accountType, existing[0].id]
    )
    log('3.4', `updated gl_account ${code} flag=${flag} balance=${balance}`)
  } else {
    await q(
      `INSERT INTO gl_accounts (id, code, name, account_type, is_system, is_active, sort_order, flag, opening_balance_cents)
       VALUES (gen_random_uuid()::text, $1, $2, $3, false, true, 0, $4, $5)`,
      [code, name, accountType, flag, openingCents]
    )
    log('3.4', `inserted gl_account ${code} (${name}) flag=${flag} balance=${balance}`)
  }
}

// ─── 3.5 Posting Codes ───────────────────────────────────────────────────────
const lpProducts = readXlsx('List_product.xlsx')
// Lookups
const feesCat       = (await q(`SELECT id FROM posting_code_categories WHERE code = 'Fees'`))[0]
const disbCat       = (await q(`SELECT id FROM posting_code_categories WHERE code = 'DISBURSEMENTS'`))[0]
const defaultDept   = (await q(`SELECT id FROM departments WHERE name = 'Default'`))[0]
const zaTaxType     = (await q(`SELECT id FROM tax_types WHERE code = 'TT_120'`))[0]

for (const p of lpProducts) {
  const code = p.product_code
  const desc = p.product_name
  if (!code || !desc) continue
  const isFees = (p.productcategory_name === 'Fees' || p.top_productcategory_name === 'Fees')
  const categoryId = isFees ? feesCat?.id : disbCat?.id
  const unitType = p.unit_uid === 'time' ? 'time' : 'qty'

  const existing = await q('SELECT id FROM posting_codes WHERE code = $1', [code])
  if (existing.length) {
    await q(
      `UPDATE posting_codes SET description = $1, category_id = $2, department_id = $3, unit_type = $4, tax_type_id = $5
       WHERE id = $6`,
      [desc, categoryId, defaultDept?.id, unitType, zaTaxType?.id, existing[0].id]
    )
    log('3.5', `updated posting_code ${code} (${desc}) unit=${unitType} category=${isFees ? 'Fees' : 'Disbursements'}`)
  } else {
    await q(
      `INSERT INTO posting_codes (id, code, description, default_billable, is_active, sort_order, category_id, department_id, unit_type, tax_type_id)
       VALUES (gen_random_uuid()::text, $1, $2, true, true, 0, $3, $4, $5, $6)`,
      [code, desc, categoryId, defaultDept?.id, unitType, zaTaxType?.id]
    )
    log('3.5', `inserted posting_code ${code} (${desc}) unit=${unitType} category=${isFees ? 'Fees' : 'Disbursements'}`)
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const summary = await q(`
  SELECT 'users' tbl, COUNT(*)::int AS rows FROM users UNION ALL
  SELECT 'fee_levels', COUNT(*) FROM fee_levels UNION ALL
  SELECT 'suppliers', COUNT(*) FROM suppliers UNION ALL
  SELECT 'gl_accounts', COUNT(*) FROM gl_accounts UNION ALL
  SELECT 'posting_codes', COUNT(*) FROM posting_codes
`)
console.log('\n── Phase 3 summary ──')
for (const r of summary) console.log(`  ${r.tbl.padEnd(18)} ${r.rows}`)

await client.end()
