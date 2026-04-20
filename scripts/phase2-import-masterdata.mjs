import XLSX from 'xlsx'
import path from 'path'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const RECON_DIR = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon'
const DATABASE_URL = process.env.DATABASE_URL

const client = new Client({ connectionString: DATABASE_URL })
await client.connect()

const readXlsx = (file) => {
  const wb = XLSX.readFile(path.join(RECON_DIR, file))
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows
const log = (phase, msg) => console.log(`[${phase}] ${msg}`)

// Load LP data up front
const lpProducts = readXlsx('List_product.xlsx')
const lpAccountCategories = readXlsx('List_accountcategory.xlsx')
const lpProductCategories = readXlsx('List_productcategory.xlsx')
const lpReceiptMethods = readXlsx('List_customerpaymentmethod (1).xlsx')
const lpSupplierTypes = readXlsx('List_suppliertype.xlsx')

// ─── 2.1 Currencies ──────────────────────────────────────────────────────────
const lpCurrencies = [...new Set(lpProducts.map(p => p.currency_uid).filter(Boolean))]
for (const code of lpCurrencies) {
  const name = lpProducts.find(p => p.currency_uid === code)?.currency_name ?? code
  const existing = await q('SELECT id FROM currencies WHERE code = $1', [code])
  if (existing.length) {
    log('2.1', `currency ${code} already exists — skipping`)
    continue
  }
  await q(
    `INSERT INTO currencies (id, code, name, symbol, is_default, sort_order)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0)`,
    [code, name, code === 'ZAR' ? 'R' : null, code === 'ZAR']
  )
  log('2.1', `inserted currency ${code} (${name})`)
}

// ─── 2.2 Tax Types ───────────────────────────────────────────────────────────
const lpTaxTypes = [...new Map(
  lpProducts.filter(p => p.taxtype_uid).map(p => [p.taxtype_uid, { code: p.taxtype_uid, name: p.taxtype_name }])
).values()]
for (const tt of lpTaxTypes) {
  const existing = await q('SELECT id FROM tax_types WHERE code = $1', [tt.code])
  if (existing.length) { log('2.2', `tax_type ${tt.code} exists — skipping`); continue }
  // Infer rate: "Not Registered" = 0%; "15%" = 15; "14%" = 14; else 0
  const rate = /not registered/i.test(tt.name) ? 0
    : /15%/.test(tt.name) ? 0.15
    : /14%/.test(tt.name) ? 0.14
    : 0
  const category = /purchase/i.test(tt.name) ? 'purchase' : 'sales'
  await q(
    `INSERT INTO tax_types (id, code, name, rate_pct, category, is_active, sort_order)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, 0)`,
    [tt.code, tt.name, rate, category]
  )
  log('2.2', `inserted tax_type ${tt.code} (${tt.name}) rate=${rate} cat=${category}`)
}

// ─── 2.3 GL Account Categories ───────────────────────────────────────────────
for (const row of lpAccountCategories) {
  if (!row.accountcategory_code) continue
  const existing = await q('SELECT id FROM gl_account_categories WHERE code = $1', [row.accountcategory_code])
  if (existing.length) { log('2.3', `gl_account_category ${row.accountcategory_code} exists — skipping`); continue }
  await q(
    `INSERT INTO gl_account_categories (id, code, name, is_system, sort_order)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
    [row.accountcategory_code, row.accountcategory_name, !!row.system, row.orderfield ?? 0]
  )
  log('2.3', `inserted gl_account_category ${row.accountcategory_code} (${row.accountcategory_name})`)
}

// ─── 2.4 Posting Code Categories ─────────────────────────────────────────────
for (const row of lpProductCategories) {
  const code = row.productcategory_code || row.productcategory_name
  if (!code) continue
  const existing = await q('SELECT id FROM posting_code_categories WHERE code = $1', [code])
  if (existing.length) { log('2.4', `posting_code_category ${code} exists — skipping`); continue }
  await q(
    `INSERT INTO posting_code_categories (id, code, name)
     VALUES (gen_random_uuid()::text, $1, $2)`,
    [code, row.productcategory_name]
  )
  log('2.4', `inserted posting_code_category ${code} (${row.productcategory_name})`)
}

// ─── 2.5 Receipt Methods ─────────────────────────────────────────────────────
for (const row of lpReceiptMethods) {
  if (!row.customerpaymentmethod_name) continue
  const existing = await q('SELECT id FROM receipt_methods WHERE name = $1', [row.customerpaymentmethod_name])
  if (existing.length) { log('2.5', `receipt_method "${row.customerpaymentmethod_name}" exists — skipping`); continue }
  await q(
    `INSERT INTO receipt_methods (id, name, bti_code, disabled, sort_order)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
    [row.customerpaymentmethod_name, row.bticode, !!row.disabled, row.orderfield ?? 0]
  )
  log('2.5', `inserted receipt_method "${row.customerpaymentmethod_name}" bti=${row.bticode}`)
}

// ─── 2.7 Supplier Types (LP empty) ───────────────────────────────────────────
for (const row of lpSupplierTypes) {
  if (!row.suppliertype_name) continue
  const existing = await q('SELECT id FROM supplier_types WHERE name = $1', [row.suppliertype_name])
  if (existing.length) continue
  await q(
    `INSERT INTO supplier_types (id, name, is_active, sort_order)
     VALUES (gen_random_uuid()::text, $1, true, 0)`,
    [row.suppliertype_name]
  )
  log('2.7', `inserted supplier_type "${row.suppliertype_name}"`)
}
if (lpSupplierTypes.length === 0) log('2.7', 'LP supplier_types empty — nothing to import')

// ─── 2.6 Bank Accounts ───────────────────────────────────────────────────────
// LP bank account data was not exported as XLSX, only as screenshot.
// Bootstrap from FirmSettings (what's already in Casey).
const firmRows = await q('SELECT * FROM firm_settings LIMIT 1')
const firm = firmRows[0]
if (firm) {
  const seedAccounts = []
  if (firm.trust_bank_account_number) {
    seedAccounts.push({
      code: 'BANK_tbank', name: firm.trust_bank_account_name ?? 'Trust Bank Account',
      account_type: 'trust', bank_name: firm.trust_bank_name,
      account_number: firm.trust_bank_account_number, branch_code: firm.trust_bank_branch_code,
      swift: firm.trust_bank_swift, bti_code: 'T',
    })
  }
  if (firm.business_bank_account_number) {
    seedAccounts.push({
      code: 'BANK_bbank', name: firm.business_bank_account_name ?? 'Business Bank Account',
      account_type: 'business', bank_name: firm.business_bank_name,
      account_number: firm.business_bank_account_number, branch_code: firm.business_bank_branch_code,
      swift: firm.business_bank_swift, bti_code: 'B',
    })
  }
  // Also add CASH (seen in account statements)
  seedAccounts.push({
    code: 'BANK_CASH', name: 'Cash', account_type: 'business',
    bank_name: null, account_number: null, branch_code: null, swift: null, bti_code: 'B',
  })
  for (const acc of seedAccounts) {
    const existing = await q('SELECT id FROM bank_accounts WHERE code = $1', [acc.code])
    if (existing.length) { log('2.6', `bank_account ${acc.code} exists — skipping`); continue }
    await q(
      `INSERT INTO bank_accounts (id, code, name, account_type, bank_name, account_number, branch_code, swift, currency_code, bti_code, is_active, sort_order)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'ZAR', $8, true, 0)`,
      [acc.code, acc.name, acc.account_type, acc.bank_name, acc.account_number, acc.branch_code, acc.swift, acc.bti_code]
    )
    log('2.6', `inserted bank_account ${acc.code}`)
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const summary = await q(`
  SELECT 'currencies' tbl, COUNT(*)::int AS rows FROM currencies UNION ALL
  SELECT 'tax_types', COUNT(*) FROM tax_types UNION ALL
  SELECT 'gl_account_categories', COUNT(*) FROM gl_account_categories UNION ALL
  SELECT 'posting_code_categories', COUNT(*) FROM posting_code_categories UNION ALL
  SELECT 'receipt_methods', COUNT(*) FROM receipt_methods UNION ALL
  SELECT 'supplier_types', COUNT(*) FROM supplier_types UNION ALL
  SELECT 'bank_accounts', COUNT(*) FROM bank_accounts
`)
console.log('\n── Phase 2 summary ──')
for (const r of summary) console.log(`  ${r.tbl.padEnd(28)} ${r.rows}`)

await client.end()
