import pg from 'pg'
import 'dotenv/config'
const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

// Add the two missing bank accounts as placeholders (firm_settings is empty — user can fill numbers later)
const banksToAdd = [
  { code: 'BANK_bbank', name: 'Business Bank account', account_type: 'business', bti: 'B' },
  { code: 'BANK_tbank', name: 'Trust bank account',     account_type: 'trust',    bti: 'T' },
]
for (const b of banksToAdd) {
  const exists = await q('SELECT id FROM bank_accounts WHERE code = $1', [b.code])
  if (exists.length) { console.log(`bank_accounts: ${b.code} exists — skip`); continue }
  await q(
    `INSERT INTO bank_accounts (id, code, name, account_type, currency_code, bti_code, is_active, sort_order)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'ZAR', $4, true, 0)`,
    [b.code, b.name, b.account_type, b.bti]
  )
  console.log(`bank_accounts: inserted ${b.code} (${b.name}) — ${b.account_type}`)
}

// Rename existing "EFT" → "EFT (Business)" and link to BANK_bbank
const bbank = (await q('SELECT id FROM bank_accounts WHERE code = $1', ['BANK_bbank']))[0]
const tbank = (await q('SELECT id FROM bank_accounts WHERE code = $1', ['BANK_tbank']))[0]
const cash  = (await q('SELECT id FROM bank_accounts WHERE code = $1', ['BANK_CASH']))[0]

// Update existing "EFT"
await q(
  `UPDATE receipt_methods SET name = $1, bank_account_id = $2 WHERE name = 'EFT'`,
  ['EFT (Business)', bbank?.id]
)
console.log('receipt_methods: renamed "EFT" → "EFT (Business)" + linked bank_account')

// Link "Cash Received" to BANK_CASH
await q(
  `UPDATE receipt_methods SET bank_account_id = $1 WHERE name = 'Cash Received'`,
  [cash?.id]
)
console.log('receipt_methods: linked "Cash Received" → BANK_CASH')

// Insert "EFT (Trust)" — distinct LP record
const trustEftExists = await q(`SELECT id FROM receipt_methods WHERE name = 'EFT (Trust)'`)
if (!trustEftExists.length) {
  await q(
    `INSERT INTO receipt_methods (id, name, bank_account_id, bti_code, disabled, sort_order)
     VALUES (gen_random_uuid()::text, 'EFT (Trust)', $1, 'T', false, 0)`,
    [tbank?.id]
  )
  console.log('receipt_methods: inserted "EFT (Trust)" → BANK_tbank')
}

// Summary
console.log('\n── state ──')
for (const r of await q('SELECT code, name, account_type, bti_code, bank_name, account_number FROM bank_accounts ORDER BY sort_order, code')) {
  console.log(`  bank_accounts: ${JSON.stringify(r)}`)
}
for (const r of await q('SELECT rm.name, rm.bti_code, ba.code AS bank_code FROM receipt_methods rm LEFT JOIN bank_accounts ba ON rm.bank_account_id = ba.id ORDER BY rm.name')) {
  console.log(`  receipt_methods: ${JSON.stringify(r)}`)
}

await client.end()
