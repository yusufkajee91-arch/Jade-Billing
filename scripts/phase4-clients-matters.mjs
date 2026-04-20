import XLSX from 'xlsx'
import path from 'path'
import pg from 'pg'
import 'dotenv/config'

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

const lpImport = (await q(`SELECT id FROM users WHERE email='lp-import@dcco.law'`))[0]
if (!lpImport) throw new Error('lp-import user missing')
const LP_IMPORT_USER_ID = lpImport.id

// Pre-load Casey users by name for owner mapping
const caseyUsers = await q(`SELECT id, email, first_name, last_name, initials FROM users`)
const userByName = (name) => {
  if (!name) return null
  const n = name.trim().toLowerCase()
  return caseyUsers.find(u =>
    n === `${u.first_name} ${u.last_name}`.toLowerCase().trim() ||
    n === `${u.first_name}-${u.last_name}`.toLowerCase() ||
    n === `${u.first_name}`.toLowerCase() ||
    n.includes(u.last_name.toLowerCase())
  )
}

// Pre-load departments & fee levels & currency & tax type
const defaultDept = (await q(`SELECT id FROM departments WHERE name='Default'`))[0]
const allDepts = await q(`SELECT id, name FROM departments`)
const zar = (await q(`SELECT id FROM currencies WHERE code='ZAR'`))[0]
const taxType120 = (await q(`SELECT id FROM tax_types WHERE code='TT_120'`))[0]
const feeLevels = await q(`SELECT id, name FROM fee_levels`)

// Entity type mapping
const entityMap = {
  'Individual (SA)': 'individual_sa',
  'Company (PTY) LTD': 'company_pty',
  'Company (LTD)': 'company_ltd',
  'Close Corporation': 'close_corporation',
  'Trust': 'trust',
  'Partnership': 'partnership',
  'Foreign Company': 'foreign_company',
}

// Department inference rules for matters not already in Casey
const inferDept = (description) => {
  const d = (description ?? '').toLowerCase()
  if (/trade ?mark|trademark|\bip\b|intellectual property|patent|copyright/.test(d)) return 'Commercial'
  if (/conveyanc|transfer|mortgage|sectional title|sale of (?:immovable )?property|bond/.test(d)) return 'Conveyancing'
  if (/litig|high court|magistrate|appeal|hearing|summons|pleadings|case no|BCEAA|CCMA/.test(d)) return 'Litigation'
  if (/divorce|custody|matrimonial|maintenance|family|minor child/.test(d)) return 'Litigation'
  return 'Default'
}

// ─── 4.1 Clients (upsert) ────────────────────────────────────────────────────
const lpClients = readXlsx('List_customer.xlsx')
log('4.1', `LP has ${lpClients.length} clients`)

let clientsUpdated = 0, clientsInserted = 0, clientsSkipped = 0
for (const c of lpClients) {
  if (!c.customer_code || !c.customer_name) continue
  const code = c.customer_code.trim()
  const name = c.customer_name.trim()
  const existing = (await q(`SELECT id FROM clients WHERE client_code = $1`, [code]))[0]

  const entityType = entityMap[c.entitytype_name] ?? 'other'
  const deptId = c.department_name
    ? allDepts.find(d => d.name.toLowerCase() === c.department_name.toLowerCase())?.id ?? defaultDept?.id
    : defaultDept?.id

  // Build LP fields — these override Casey's values (except FICA/is_active)
  const fields = {
    client_name: name,
    entity_type: entityType,
    email_general: c.email ?? null,
    email_invoices: c.accountsemail ?? null,
    tel: c.tel ?? null,
    mobile: c.cell ?? null,
    vat_number: c.vatnumber ?? null,
    // LP-parity fields
    trading_as: c.tradingas ?? null,
    reg_number: c.regnumber ?? null,
    id_number: c.idnumber ?? null,
    title: c.title ?? null,
    first_name: c.firstname ?? null,
    surname: c.surname ?? null,
    tax_number: c.taxnumber ?? null,
    fax: c.fax ?? null,
    website: c.website ?? null,
    sector: c.sector ?? null,
    notes: c.notes ?? null,
    credit_terms: c.creditterms ? String(c.creditterms) : null,
    bank_name: c.bankname ?? null,
    bank_account: c.bankaccount ?? null,
    bank_branch: c.bankbranch ?? null,
    currency_id: zar?.id ?? null,
    tax_type_id: taxType120?.id ?? null,
    client_ref: c.clientref ?? null,
    account_number: c.accountnumber ?? null,
    department_id: deptId,
  }

  if (existing) {
    // Upsert — overwrite LP-authoritative fields, preserve FICA + is_active
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`).join(', ')
    const vals = Object.values(fields)
    await q(`UPDATE clients SET ${sets}, updated_at = NOW() WHERE id = $${vals.length + 1}`, [...vals, existing.id])
    clientsUpdated++
  } else {
    // Insert new (Casey-only so far — none expected, but handle)
    await q(
      `INSERT INTO clients (id, client_code, client_name, entity_type, email_general, email_invoices, tel, mobile,
        vat_number, fica_status, is_active, created_by, created_at, updated_at,
        trading_as, reg_number, id_number, title, first_name, surname, tax_number, fax, website, sector, notes,
        credit_terms, bank_name, bank_account, bank_branch, currency_id, tax_type_id, client_ref, account_number, department_id)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'not_compliant', true, $9, NOW(), NOW(),
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
      [code, name, entityType, fields.email_general, fields.email_invoices, fields.tel, fields.mobile,
       fields.vat_number, LP_IMPORT_USER_ID,
       fields.trading_as, fields.reg_number, fields.id_number, fields.title, fields.first_name, fields.surname,
       fields.tax_number, fields.fax, fields.website, fields.sector, fields.notes, fields.credit_terms,
       fields.bank_name, fields.bank_account, fields.bank_branch, fields.currency_id, fields.tax_type_id,
       fields.client_ref, fields.account_number, fields.department_id]
    )
    clientsInserted++
  }
}
log('4.1', `clients: ${clientsUpdated} updated, ${clientsInserted} inserted, ${clientsSkipped} skipped`)

// ─── 4.2 Matters (upsert, preserve Casey-native fields) ──────────────────────
const lpMatters = readXlsx('List_matter.xlsx')
log('4.2', `LP has ${lpMatters.length} matters`)

// Pre-load clients for FK mapping
const clientByCode = new Map((await q(`SELECT id, client_code FROM clients`)).map(r => [r.client_code, r.id]))

let mattersUpdated = 0, mattersInserted = 0, mattersDeptInferred = 0
let mattersMissingOwner = 0, mattersMissingClient = 0
for (const m of lpMatters) {
  if (!m.matter_code || !m.customer_id) continue
  const code = m.matter_code.trim()
  // Casey client_code is LP customer_code. But LP matter references customer_id (UID). Use customer_name fallback.
  // Actually LP matter has customer_name; Casey has client_code keyed differently.
  // The LP export has customer_code implied via looking up from List_customer.
  // Simpler: look up LP customer by uid to get its code.
  // But List_customer exports customer_code. So we need to join.
  // For now, since LP's 370 customers all have customer_code, and Casey has the same code, use name-based lookup.
  const lpCust = lpClients.find(c => c.customer_id === m.customer_id)
  const lpCustCode = lpCust?.customer_code?.trim()
  const clientId = lpCustCode ? clientByCode.get(lpCustCode) : null
  if (!clientId) { mattersMissingClient++; continue }

  const owner = userByName(m.owner_salesagent_name)
  if (!owner) {
    mattersMissingOwner++
    continue
  }

  const existing = (await q(`SELECT id, department_id, notes, comment, to_do, matter_status_note, allocation, loe_fica_done, billing_status FROM matters WHERE matter_code = $1`, [code]))[0]

  const feeLevelId = m.feelevel_name ? feeLevels.find(fl => fl.name === m.feelevel_name)?.id : null
  const discountPct = Math.round(Number(m.defaultdiscountpercent ?? 0))
  const dateOpened = m.dateopened && m.dateopened !== '1970-01-01' ? new Date(m.dateopened) : new Date()

  // Department: for new matters, infer from description. For existing, preserve Casey's dept.
  const inferredDept = inferDept(m.matter_name)
  const deptRow = allDepts.find(d => d.name === inferredDept)
  const deptIdForNew = deptRow?.id ?? defaultDept?.id

  // LP fields to overwrite
  const lpFields = {
    client_id: clientId,
    description: (m.matter_name ?? '').trim() || code,
    owner_id: owner.id,
    date_opened: dateOpened,
    client_ref: m.clientref ?? null,
    account_number: m.accountnumber ?? null,
    restricted: m.restricted === 'restricted',
    billing_entity_override: m.billingentityoverride ?? null,
    default_discount_percent: discountPct,
    fee_level_id: feeLevelId,
    investment_name: m.investmentname ?? null,
    claim_amount_cents: m.claimamount ? Math.round(Number(m.claimamount) * 100) : null,
    reserve_trust: m.reservetrust ?? null,
    fee_cap_cents: m.feecap ? Math.round(Number(m.feecap) * 100) : null,
    fee_cap_period: m.feecapperiod ?? null,
    tax_number: m.taxnumber ?? null,
    css_class: m.cssclass ?? null,
    email: m.email ?? null,
    accounts_email: m.accountsemail ?? null,
  }

  if (existing) {
    // Upsert — preserve Casey-native fields
    const sets = Object.keys(lpFields).map((k, i) => `${k} = $${i + 1}`).join(', ')
    const vals = Object.values(lpFields)
    await q(`UPDATE matters SET ${sets}, updated_at = NOW() WHERE id = $${vals.length + 1}`, [...vals, existing.id])
    mattersUpdated++
  } else {
    // Insert new — use inferred dept
    await q(
      `INSERT INTO matters (id, matter_code, client_id, description, department_id, owner_id, status, date_opened,
        created_by, created_at, updated_at,
        client_ref, account_number, restricted, billing_entity_override, default_discount_percent, fee_level_id,
        investment_name, claim_amount_cents, reserve_trust, fee_cap_cents, fee_cap_period, tax_number, css_class, email, accounts_email)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'open', $6, $7, NOW(), NOW(),
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [code, clientId, lpFields.description, deptIdForNew, owner.id, dateOpened, LP_IMPORT_USER_ID,
       lpFields.client_ref, lpFields.account_number, lpFields.restricted, lpFields.billing_entity_override,
       lpFields.default_discount_percent, lpFields.fee_level_id, lpFields.investment_name,
       lpFields.claim_amount_cents, lpFields.reserve_trust, lpFields.fee_cap_cents, lpFields.fee_cap_period,
       lpFields.tax_number, lpFields.css_class, lpFields.email, lpFields.accounts_email]
    )
    mattersInserted++
    mattersDeptInferred++
  }
}
log('4.2', `matters: ${mattersUpdated} updated, ${mattersInserted} inserted (${mattersDeptInferred} with dept inferred), ${mattersMissingOwner} missing owner, ${mattersMissingClient} missing client`)

// ─── Summary ─────────────────────────────────────────────────────────────────
const summary = await q(`
  SELECT 'clients' tbl, COUNT(*)::int AS rows FROM clients UNION ALL
  SELECT 'clients with dept', COUNT(*) FROM clients WHERE department_id IS NOT NULL UNION ALL
  SELECT 'clients with trading_as', COUNT(*) FROM clients WHERE trading_as IS NOT NULL UNION ALL
  SELECT 'matters', COUNT(*) FROM matters UNION ALL
  SELECT 'matters with fee_level', COUNT(*) FROM matters WHERE fee_level_id IS NOT NULL UNION ALL
  SELECT 'matters with client_ref', COUNT(*) FROM matters WHERE client_ref IS NOT NULL
`)
console.log('\n── Phase 4 summary ──')
for (const r of summary) console.log(`  ${r.tbl.padEnd(30)} ${r.rows}`)

// Dept distribution
const depts = await q(`SELECT d.name, COUNT(m.id)::int AS n FROM departments d LEFT JOIN matters m ON m.department_id=d.id GROUP BY d.name ORDER BY n DESC`)
console.log('\n── Matter distribution by department ──')
for (const d of depts) console.log(`  ${d.name.padEnd(15)} ${d.n}`)

await client.end()
