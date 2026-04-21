import XLSX from 'xlsx'
import path from 'path'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg
const RECON = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon'
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows
const readXlsx = (file) => {
  const wb = XLSX.readFile(path.join(RECON, file), { cellDates: true })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
}

const fmt = (v) => v === null || v === undefined ? '—' : String(v)
const pad = (s, n) => String(s).padEnd(n)
const padR = (s, n) => String(s).padStart(n)

console.log('═'.repeat(95))
console.log(pad('CHECK', 40), padR('LP', 10), padR('CASEY', 10), padR('STATUS', 12))
console.log('─'.repeat(95))

const check = (name, lp, casey, ok = lp === casey) => {
  const status = ok ? '✓ MATCH' : (typeof lp === 'number' && typeof casey === 'number' ? `Δ ${casey - lp}` : 'CHECK')
  console.log(pad(name, 40), padR(fmt(lp), 10), padR(fmt(casey), 10), padR(status, 12))
}

// ─── Masterfiles ────────────────────────────────────────────────────────────
const lpClients = readXlsx('List_customer.xlsx').filter(r => r.customer_code)
check('Clients', lpClients.length,
  (await q(`SELECT COUNT(*)::int n FROM clients`))[0].n)

const lpMatters = readXlsx('List_matter.xlsx').filter(r => r.matter_code)
check('Matters (LP)', lpMatters.length,
  (await q(`SELECT COUNT(*)::int n FROM matters`))[0].n,
  // Casey will have +Casey-only; LP is subset
  (await q(`SELECT COUNT(*)::int n FROM matters`))[0].n >= lpMatters.length)

const lpFeeLevels = readXlsx('List_feelevel (4).xlsx').filter(r => r.feelevel_name)
check('Fee Levels', lpFeeLevels.length,
  (await q(`SELECT COUNT(*)::int n FROM fee_levels`))[0].n)

const lpProducts = readXlsx('List_product.xlsx').filter(r => r.product_code)
const caseyPostingCodes = (await q(`SELECT COUNT(*)::int n FROM posting_codes`))[0].n
check('Posting Codes (LP)', lpProducts.length, caseyPostingCodes,
  caseyPostingCodes >= lpProducts.length)

const lpProductCats = readXlsx('List_productcategory.xlsx').filter(r => r.productcategory_name)
check('Posting Code Categories', lpProductCats.length,
  (await q(`SELECT COUNT(*)::int n FROM posting_code_categories`))[0].n)

const lpAccountCats = readXlsx('List_accountcategory.xlsx').filter(r => r.accountcategory_code)
check('GL Account Categories', lpAccountCats.length,
  (await q(`SELECT COUNT(*)::int n FROM gl_account_categories`))[0].n)

const lpReceiptMethods = readXlsx('List_customerpaymentmethod (1).xlsx').filter(r => r.customerpaymentmethod_name)
check('Receipt Methods', lpReceiptMethods.length,
  (await q(`SELECT COUNT(*)::int n FROM receipt_methods`))[0].n)

const lpSuppliers = readXlsx('List_supplier.xlsx').filter(r => r.supplier_name)
check('Suppliers', lpSuppliers.length,
  (await q(`SELECT COUNT(*)::int n FROM suppliers`))[0].n)

const lpSupplierTypes = readXlsx('List_suppliertype.xlsx').filter(r => r.suppliertype_name)
check('Supplier Types', lpSupplierTypes.length,
  (await q(`SELECT COUNT(*)::int n FROM supplier_types`))[0].n)

const lpContacts = readXlsx('List_contact (1).xlsx').filter(r => r.contact_id || r.firstname || r.surname)
check('Contacts', lpContacts.length,
  (await q(`SELECT COUNT(*)::int n FROM contacts`))[0].n)

const lpCanned = readXlsx('List_cannednarration.xlsx').filter(r => r.cannednarration_name)
check('Canned Narrations', lpCanned.length,
  (await q(`SELECT COUNT(*)::int n FROM canned_narrations`))[0].n)

const lpDept = readXlsx('List_department.xlsx').filter(r => r.department_name)
const caseyDeptCount = (await q(`SELECT COUNT(*)::int n FROM departments`))[0].n
check('Departments (LP=1, Casey=4)', lpDept.length, caseyDeptCount, caseyDeptCount >= lpDept.length)

const lpLogins = readXlsx('List_login.xlsx').filter(r => r.login_name)
const caseyUsersCount = (await q(`SELECT COUNT(*)::int n FROM users`))[0].n
check('Users (LP logins)', lpLogins.length, caseyUsersCount)

const lpSalesagents = readXlsx('List_salesagent.xlsx').filter(r => r.salesagent_name)
const caseyFeeEarners = (await q(`SELECT COUNT(*)::int n FROM users WHERE role='fee_earner'`))[0].n
check('Fee Earners (LP salesagents)', lpSalesagents.length, caseyFeeEarners,
  caseyFeeEarners >= lpSalesagents.length)

const lpAccounts = readXlsx('Export-Accounts-as-at-2026-04-19.xlsx').filter(r => r['Account Code'])
const lpAccountsDistinct = new Set(lpAccounts.map(r => r['Account Code'])).size
check('GL Accounts (distinct codes)', lpAccountsDistinct,
  (await q(`SELECT COUNT(*)::int n FROM gl_accounts`))[0].n)

// ─── Transactional ──────────────────────────────────────────────────────────
console.log('─'.repeat(95))
console.log('TRANSACTIONAL')
console.log('─'.repeat(95))

const lpWip = readXlsx('Export-WIP-History-between-2021-01-01-and-2026-04-19-incl-.xlsx').filter(r => r['Matter Code'])
const lpWipSum = lpWip.reduce((s, r) => s + Number(r['Amount (ex VAT)'] ?? r.Amount ?? 0), 0)
check('Fee entries (count)', lpWip.length,
  (await q(`SELECT COUNT(*)::int n FROM fee_entries WHERE is_historical=true`))[0].n)
check('Fee entries sum (R)', Math.round(lpWipSum * 100) / 100,
  Number((await q(`SELECT (SUM(total_cents)/100.0)::numeric(14,2) AS sum FROM fee_entries WHERE is_historical=true`))[0].sum))

const lpInvoiced = readXlsx('Invoiced-Fees-and-Disbursements (1).xlsx').filter(r => r.Reference)
const lpInvoiceCount = new Set(lpInvoiced.map(r => r.Reference)).size
check('Invoices (distinct refs)', lpInvoiceCount,
  (await q(`SELECT COUNT(*)::int n FROM invoices`))[0].n)
check('Invoice line items', lpInvoiced.length,
  (await q(`SELECT COUNT(*)::int n FROM invoice_line_items`))[0].n)

// Trust ledger
const trustLedger = readXlsx('Detailed-Matter-Ledger-for-2021-01-01-to-2026-04-19-T-ZAR-.xlsx').filter(r => r.type && !['OPENING','CLOSING','Journal'].includes(r.type))
check('Trust entries', trustLedger.length,
  (await q(`SELECT COUNT(*)::int n FROM trust_entries`))[0].n)
const trustNet = (await q(`SELECT (SUM(CASE WHEN entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt') THEN amount_cents WHEN entry_type IN ('trust_payment','trust_transfer_out') THEN -amount_cents ELSE 0 END)/100.0)::numeric(14,2) AS s FROM trust_entries`))[0].s
check('Trust closing balance (R)', 474204.67, Number(trustNet))

// Business
const bizStmt = readXlsx('AccountStatementforBank-BusinessBankaccount-BANK_bbank-from2021-01-01to2026-04-19-incl-.xlsx').filter(r => r.object && r.Date instanceof Date)
check('Business entries', bizStmt.length,
  (await q(`SELECT COUNT(*)::int n FROM business_entries`))[0].n)
const bizNet = (await q(`SELECT (SUM(CASE WHEN entry_type IN ('matter_receipt','business_receipt','trust_to_business') THEN amount_cents WHEN entry_type IN ('matter_payment','business_payment','supplier_payment','supplier_invoice','bank_transfer') THEN -amount_cents ELSE 0 END)/100.0)::numeric(14,2) AS s FROM business_entries`))[0].s
check('Business closing balance (R)', 127797.18, Number(bizNet))

// Investment
const inv = readXlsx('Trust and Investments 2026-04-19.xlsx').filter(r => r['Investment Balance as at 2026-04-19'])
const invMatters = inv.filter(r => Number(r['Investment Balance as at 2026-04-19']) > 0)
check('Matters with investment balance', invMatters.length,
  (await q(`SELECT COUNT(DISTINCT matter_id)::int n FROM investment_entries`))[0].n)

// Trust transfers (List)
const trustTransfers = readXlsx('List_trusttransfer.xlsx').filter(r => r.trusttransfer_code)
check('Trust transfers (refs)', trustTransfers.length,
  (await q(`SELECT COUNT(DISTINCT reference_number)::int n FROM trust_entries WHERE entry_type IN ('trust_transfer_out','trust_transfer_in')`))[0].n)

// Bank CASH movements (501 lines)
const cashStmt = readXlsx('AccountStatementforBank-CASH-BANK_CASH-from2021-01-01to2026-04-19-incl-.xlsx').filter(r => r.object && r.Date instanceof Date)
const cashImported = (await q(`SELECT COUNT(*)::int n FROM business_entries WHERE narration ILIKE '%cash%' OR reference_number IN (SELECT 'X' WHERE FALSE)`))[0].n
check('Bank CASH transactions in source', cashStmt.length, cashImported, false)

// Audit Trail (verification — not imported, just count for reference)
const auditTrail = readXlsx('audittrail_stampdate_2021-01-01_2026-04-17.xlsx').filter(r => r['Trans. Type'])
console.log(pad('Audit trail (LP source rows)', 40), padR(auditTrail.length, 10), padR('—', 10), padR('verification', 12))

// Total journal_lines created (auto)
const journalLines = (await q(`SELECT COUNT(*)::int n FROM journal_lines`))[0].n
console.log(pad('Journal lines (auto-generated)', 40), padR('—', 10), padR(journalLines, 10), padR('—', 12))

// FICA
const fica = readXlsx('FICA-Report.xlsx').filter(r => r.Code && r['FICA Status'])
const ficaCompliant = (await q(`SELECT COUNT(*)::int n FROM clients WHERE fica_status='compliant'`))[0].n
const ficaNot = (await q(`SELECT COUNT(*)::int n FROM clients WHERE fica_status='not_compliant'`))[0].n
const lpFicaCompliant = fica.filter(r => r['FICA Status'] === 'green').length
const lpFicaRed = fica.filter(r => r['FICA Status'] === 'red').length
check('FICA compliant clients', lpFicaCompliant, ficaCompliant)
check('FICA non-compliant marked', lpFicaRed, ficaNot, ficaNot >= lpFicaRed)

await client.end()
