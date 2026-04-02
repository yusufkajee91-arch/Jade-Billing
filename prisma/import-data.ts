import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as XLSX from 'xlsx'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Create a .env.local file.')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// ─── Data file paths ─────────────────────────────────────────────────────────
const DATA_DIR = path.join(
  __dirname,
  '..',
  'Documentation',
  '31 March Data',
  'Data To Be Imported',
)
const CLIENT_FILE = path.join(DATA_DIR, '26.03.31 Client List as-at-2026-03-18.xlsx')
const MATTER_FILE = path.join(DATA_DIR, '26.03.31 Matter List as-at-2026-03-18.xlsx')
const FEE_FILE = path.join(
  DATA_DIR,
  '26.03.31 Invoiced-Fees-and-Disbursements as-at-2026-03-18 - Rand.xlsx',
)

// ─── User mapping ────────────────────────────────────────────────────────────
// Jessica Dolata is the principal — used as fallback for System, Gisele, Maxine
const JESSICA_ID = '09bdbcb0-c7eb-473e-9d70-6e8a2d1646bd'
const LAKEN_ASH_ID = '6efb0867-2943-4e80-a4d2-8423777d6be1' // Lycan Ash = Laken-Ash

function mapOwnerToUserId(name: string): string {
  if (!name) return JESSICA_ID
  const n = name.trim().toLowerCase()
  if (n.includes('jessica') || n.includes('dolata')) return JESSICA_ID
  if (n.includes('laken') || n.includes('lycan') || n === 'la') return LAKEN_ASH_ID
  // Gisele Mans, Maxine Clement, System → Jessica
  return JESSICA_ID
}

// ─── Posting code definitions ────────────────────────────────────────────────
const POSTING_CODES: { code: string; description: string; defaultBillable: boolean }[] = [
  // Time-based fees (Z010-Z070)
  { code: 'Z010', description: 'Attendance / Consultation', defaultBillable: true },
  { code: 'Z020', description: 'Drafting / Preparation', defaultBillable: true },
  { code: 'Z030', description: 'Perusal / Review', defaultBillable: true },
  { code: 'Z040', description: 'Research', defaultBillable: true },
  { code: 'Z050', description: 'Telephone / Conference', defaultBillable: true },
  { code: 'Z060', description: 'Correspondence', defaultBillable: true },
  { code: 'Z070', description: 'Travel', defaultBillable: true },
  // Unitary fees (Z080-Z110, Z260-Z280)
  { code: 'Z080', description: 'Agreed / Fixed Fee', defaultBillable: true },
  { code: 'Z090', description: 'Court Appearance', defaultBillable: true },
  { code: 'Z110', description: 'Miscellaneous Fee', defaultBillable: true },
  { code: 'Z260', description: 'Statutory Fee', defaultBillable: true },
  { code: 'Z270', description: 'Professional Fee', defaultBillable: true },
  { code: 'Z280', description: 'Administrative Fee', defaultBillable: true },
  // Disbursements (Z120-Z230)
  { code: 'Z120', description: 'Official / Filing Fees', defaultBillable: true },
  { code: 'Z130', description: 'Trade Mark Filing Fee', defaultBillable: true },
  { code: 'Z140', description: 'Court Fees / Sheriff', defaultBillable: true },
  { code: 'Z150', description: 'Postage / Courier', defaultBillable: true },
  { code: 'Z170', description: 'Search Fees', defaultBillable: true },
  { code: 'Z180', description: 'Printing / Copies', defaultBillable: true },
  { code: 'Z190', description: 'Travel Disbursement', defaultBillable: true },
  { code: 'Z200', description: 'Third Party Disbursement', defaultBillable: true },
  { code: 'Z230', description: 'Other Disbursement', defaultBillable: true },
]

// Posting codes that are disbursements
const DISBURSEMENT_CODES = new Set([
  'Z120', 'Z130', 'Z140', 'Z150', 'Z170', 'Z180', 'Z190', 'Z200', 'Z230',
])

// Posting codes that are time-based (have minutes)
const TIME_CODES = new Set(['Z010', 'Z020', 'Z030', 'Z040', 'Z050', 'Z060', 'Z070'])

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readSheet(filePath: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws)
}

function toDate(val: unknown): Date {
  if (val instanceof Date) {
    // Ensure UTC midnight to avoid timezone shifting @db.Date fields
    return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()))
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    return new Date(Date.UTC(d.y, d.m - 1, d.d))
  }
  if (typeof val === 'string') {
    // Parse date string and construct as UTC midnight
    // Handles "2024-08-05 00:00:00" and "2024-08-05" formats
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])))
    }
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    }
  }
  return new Date()
}

function toCents(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

// ─── Step 1: Posting Codes ───────────────────────────────────────────────────
async function importPostingCodes(): Promise<Map<string, string>> {
  console.log('\n── Importing Posting Codes ──')
  const codeToId = new Map<string, string>()

  for (let i = 0; i < POSTING_CODES.length; i++) {
    const pc = POSTING_CODES[i]
    const result = await prisma.postingCode.upsert({
      where: { code: pc.code },
      update: { description: pc.description },
      create: {
        code: pc.code,
        description: pc.description,
        defaultBillable: pc.defaultBillable,
        sortOrder: 100 + i,
      },
    })
    codeToId.set(pc.code, result.id)
  }

  console.log(`  Created/updated ${POSTING_CODES.length} posting codes`)
  return codeToId
}

// ─── Step 2: Clients ─────────────────────────────────────────────────────────
async function importClients(): Promise<Map<string, string>> {
  console.log('\n── Importing Clients ──')
  const rows = readSheet(CLIENT_FILE)
  const codeToId = new Map<string, string>()
  let created = 0
  let skipped = 0

  for (const row of rows) {
    const clientCode = String(row['customer_code'] || '').trim()
    if (!clientCode) continue

    const clientName = String(row['customer_name'] || '').trim()
    if (!clientName) continue

    // Check if already exists
    const existing = await prisma.client.findUnique({ where: { clientCode } })
    if (existing) {
      codeToId.set(clientCode, existing.id)
      skipped++
      continue
    }

    const loginName = String(row['login_name'] || 'System')
    const createdById = mapOwnerToUserId(loginName)

    // Parse address (multi-line string)
    const streetAddr = String(row['streetaddress'] || '')
    const postalAddr = String(row['postaladdress'] || '')

    const client = await prisma.client.create({
      data: {
        clientCode,
        clientName,
        entityType: 'other',
        emailGeneral: row['email'] ? String(row['email']).trim() : null,
        emailInvoices: row['accountsemail'] ? String(row['accountsemail']).trim() : null,
        emailStatements: row['invoiceemail'] ? String(row['invoiceemail']).trim() : null,
        tel: row['tel'] ? String(row['tel']).trim() : null,
        mobile: row['cell'] ? String(row['cell']).trim() : null,
        physicalAddressLine1: streetAddr || null,
        postalAddressLine1: postalAddr || null,
        vatNumber: row['taxnumber'] ? String(row['taxnumber']).trim() : null,
        isActive: true,
        createdById,
      },
    })
    codeToId.set(clientCode, client.id)
    created++
  }

  console.log(`  Created: ${created}, Skipped (existing): ${skipped}`)
  return codeToId
}

// ─── Step 3: Matters ─────────────────────────────────────────────────────────
async function importMatters(
  clientCodeToId: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('\n── Importing Matters ──')
  const rows = readSheet(MATTER_FILE)
  const matterCodeToId = new Map<string, string>()
  let created = 0
  let skipped = 0
  let missingClient = 0

  for (const row of rows) {
    const matterCode = String(row['Matter Code'] || '').trim()
    if (!matterCode) continue

    // Check if already exists
    const existing = await prisma.matter.findUnique({ where: { matterCode } })
    if (existing) {
      matterCodeToId.set(matterCode, existing.id)
      skipped++
      continue
    }

    const clientCode = String(row['Client Code'] || '').trim()
    let clientId = clientCodeToId.get(clientCode)

    if (!clientId) {
      // Try DB lookup
      const dbClient = await prisma.client.findUnique({ where: { clientCode } })
      if (dbClient) {
        clientId = dbClient.id
        clientCodeToId.set(clientCode, clientId)
      } else {
        missingClient++
        // Create a minimal client record so we don't lose the matter
        const clientName = String(row['Client Name'] || clientCode).trim()
        const newClient = await prisma.client.create({
          data: {
            clientCode,
            clientName,
            entityType: 'other',
            emailGeneral: row['Email'] ? String(row['Email']).trim() : null,
            createdById: JESSICA_ID,
          },
        })
        clientId = newClient.id
        clientCodeToId.set(clientCode, clientId)
        console.log(`    Auto-created client: ${clientCode} (${clientName})`)
      }
    }

    const ownerName = String(row['Owner'] || '').trim()
    const ownerId = mapOwnerToUserId(ownerName)
    const description = String(row['Matter Description'] || '').trim()
    const dateOpened = toDate(row['Date Opened'])

    const matter = await prisma.matter.create({
      data: {
        matterCode,
        clientId,
        description: description || matterCode,
        departmentId: 'seed-dept-default',
        ownerId,
        status: 'open',
        dateOpened,
        createdById: ownerId,
      },
    })
    matterCodeToId.set(matterCode, matter.id)
    created++
  }

  console.log(`  Created: ${created}, Skipped: ${skipped}, Auto-created clients: ${missingClient}`)
  return matterCodeToId
}

// ─── Step 4 & 5: Fee Entries + Invoices ──────────────────────────────────────
async function importFeesAndInvoices(
  clientCodeToId: Map<string, string>,
  matterCodeToId: Map<string, string>,
  postingCodeToId: Map<string, string>,
) {
  console.log('\n── Importing Fee Entries & Invoices ──')
  const rows = readSheet(FEE_FILE)

  // Group rows by invoice number
  const invoiceGroups = new Map<
    string,
    { invoiceDate: Date; rows: Record<string, unknown>[] }
  >()

  for (const row of rows) {
    const ref = String(row['Reference'] || '').trim()
    if (!ref) continue

    if (!invoiceGroups.has(ref)) {
      invoiceGroups.set(ref, {
        invoiceDate: toDate(row['Date Invoiced']),
        rows: [],
      })
    }
    invoiceGroups.get(ref)!.rows.push(row)
  }

  console.log(`  Found ${invoiceGroups.size} invoices with ${rows.length} line items`)

  // Get firm settings for invoice snapshots
  const firmSettings = await prisma.firmSettings.findFirst()
  const firmName = firmSettings?.firmName || 'Dolata & Co Attorneys'

  let feeEntriesCreated = 0
  let invoicesCreated = 0
  let mattersMissing = 0

  for (const [invoiceNumber, group] of invoiceGroups) {
    // Determine matter and client from first row
    const firstRow = group.rows[0]
    const matterCode = String(firstRow['Matter Code'] || '').trim()

    let matterId = matterCodeToId.get(matterCode)
    if (!matterId) {
      // Try DB lookup
      const dbMatter = await prisma.matter.findUnique({ where: { matterCode } })
      if (dbMatter) {
        matterId = dbMatter.id
        matterCodeToId.set(matterCode, matterId)
      } else {
        // Need to create matter + possibly client
        mattersMissing++
        const customerField = String(firstRow['Customer'] || '').trim()
        // Extract client code from customer field: "Name [CODE]"
        const codeMatch = customerField.match(/\[([^\]]+)\]/)
        const clientCode = codeMatch ? codeMatch[1] : matterCode.split('-')[0]
        const clientName = customerField.replace(/\s*\[.*\]/, '') || clientCode

        let clientId = clientCodeToId.get(clientCode)
        if (!clientId) {
          const dbClient = await prisma.client.findUnique({ where: { clientCode } })
          if (dbClient) {
            clientId = dbClient.id
          } else {
            const newClient = await prisma.client.create({
              data: {
                clientCode,
                clientName,
                entityType: 'other',
                createdById: JESSICA_ID,
              },
            })
            clientId = newClient.id
            console.log(`    Auto-created client for invoice: ${clientCode}`)
          }
          clientCodeToId.set(clientCode, clientId)
        }

        const matterDesc = String(firstRow['Matter Name'] || matterCode).trim()
        const newMatter = await prisma.matter.create({
          data: {
            matterCode,
            clientId,
            description: matterDesc || matterCode,
            departmentId: 'seed-dept-default',
            ownerId: JESSICA_ID,
            status: 'open',
            createdById: JESSICA_ID,
          },
        })
        matterId = newMatter.id
        matterCodeToId.set(matterCode, matterId)
        console.log(`    Auto-created matter for invoice: ${matterCode}`)
      }
    }

    // Get the matter's client
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      include: { client: true },
    })
    if (!matter) continue

    // Create fee entries and collect line item data
    const lineItems: {
      feeEntryId: string
      entryDate: Date
      entryType: string
      costCentre: string
      description: string
      durationMinutesBilled: number | null
      unitQuantityThousandths: number | null
      rateCents: number
      amountCents: number
      totalCents: number
      sortOrder: number
    }[] = []

    let invoiceSubTotalCents = 0
    let invoiceVatCents = 0

    for (let i = 0; i < group.rows.length; i++) {
      const row = group.rows[i]
      const postingCode = String(row['Posting Code'] || '').trim()
      const narration = String(row['Narration'] || '').trim()
      const entryDate = toDate(row['Date'])
      const feeEarnerName = String(row['Fee Earner'] || '').trim()
      const feeEarnerId = mapOwnerToUserId(feeEarnerName)

      const qty = parseFloat(String(row['Qty'] || '0')) || 0
      const unitPrice = parseFloat(String(row['Unit Price'] || '0')) || 0
      const minutes = row['Minutes'] ? parseInt(String(row['Minutes']), 10) : null
      const disbAmount = parseFloat(String(row['DISBURSEMENTS Amount'] || '0')) || 0
      const feesAmount = parseFloat(String(row['FEES Amount'] || '0')) || 0
      const vatAmount = parseFloat(String(row['vat Amount'] || '0')) || 0

      // Determine entry type
      let entryType: 'time' | 'unitary' | 'disbursement'
      if (DISBURSEMENT_CODES.has(postingCode) || disbAmount > 0) {
        entryType = 'disbursement'
      } else if (TIME_CODES.has(postingCode) && minutes) {
        entryType = 'time'
      } else {
        entryType = 'unitary'
      }

      const rawAmount = entryType === 'disbursement' ? disbAmount : feesAmount
      const rateCents = toCents(unitPrice)
      const amountCents = toCents(rawAmount)
      const totalCents = amountCents // no discount in historical data

      const postingCodeId = postingCodeToId.get(postingCode) || null

      // Build fee entry data
      const feeEntryData: Parameters<typeof prisma.feeEntry.create>[0]['data'] = {
        matterId,
        entryType,
        entryDate,
        narration: narration || 'Historical entry',
        rateCents,
        amountCents,
        discountPct: 0,
        discountCents: 0,
        totalCents,
        isBillable: true,
        isInvoiced: true,
        isHistorical: true,
        feeEarnerId,
        feeEarnerName: feeEarnerName || null,
        createdById: JESSICA_ID,
        postingCodeId,
      }

      if (entryType === 'time' && minutes) {
        feeEntryData.durationMinutesRaw = minutes
        feeEntryData.durationMinutesBilled = minutes
      }

      if (entryType === 'unitary') {
        // Store qty as thousandths (e.g., 1.85 → 1850)
        feeEntryData.unitQuantityThousandths = Math.round(qty * 1000)
      }

      const feeEntry = await prisma.feeEntry.create({ data: feeEntryData })
      feeEntriesCreated++

      // Prepare invoice line item
      lineItems.push({
        feeEntryId: feeEntry.id,
        entryDate,
        entryType,
        costCentre: feeEarnerName || 'JD',
        description: narration || 'Historical entry',
        durationMinutesBilled: entryType === 'time' ? minutes : null,
        unitQuantityThousandths:
          entryType === 'unitary' ? Math.round(qty * 1000) : null,
        rateCents,
        amountCents,
        totalCents,
        sortOrder: i,
      })

      invoiceSubTotalCents += totalCents
      invoiceVatCents += toCents(vatAmount)
    }

    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: 'invoice',
        status: 'paid',
        matterId,
        clientId: matter.clientId,
        matterCode: matter.matterCode,
        matterDescription: matter.description,
        clientName: matter.client.clientName,
        clientEmail: matter.client.emailGeneral,
        firmName,
        vatRegistered: false,
        vatRateBps: 1500,
        subTotalCents: invoiceSubTotalCents,
        vatCents: invoiceVatCents,
        totalCents: invoiceSubTotalCents + invoiceVatCents,
        invoiceDate: group.invoiceDate,
        paidAt: group.invoiceDate,
        paidNote: 'Historical import — marked as paid',
        isHistorical: true,
        createdById: JESSICA_ID,
      },
    })
    invoicesCreated++

    // Create invoice line items
    for (const li of lineItems) {
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          feeEntryId: li.feeEntryId,
          entryDate: li.entryDate,
          entryType: li.entryType,
          costCentre: li.costCentre,
          description: li.description,
          durationMinutesBilled: li.durationMinutesBilled,
          unitQuantityThousandths: li.unitQuantityThousandths,
          rateCents: li.rateCents,
          amountCents: li.amountCents,
          discountPct: 0,
          discountCents: 0,
          totalCents: li.totalCents,
          sortOrder: li.sortOrder,
        },
      })
    }
  }

  console.log(`  Fee entries created: ${feeEntriesCreated}`)
  console.log(`  Invoices created: ${invoicesCreated}`)
  console.log(`  Matters auto-created for invoices: ${mattersMissing}`)
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== DCCO Billing Data Import ===')
  console.log(`Data directory: ${DATA_DIR}`)

  const postingCodeToId = await importPostingCodes()
  const clientCodeToId = await importClients()
  const matterCodeToId = await importMatters(clientCodeToId)
  await importFeesAndInvoices(clientCodeToId, matterCodeToId, postingCodeToId)

  // Final counts
  console.log('\n── Final Database Counts ──')
  const counts = await Promise.all([
    prisma.client.count(),
    prisma.matter.count(),
    prisma.feeEntry.count(),
    prisma.invoice.count(),
    prisma.invoiceLineItem.count(),
    prisma.postingCode.count(),
  ])
  console.log(`  Clients: ${counts[0]}`)
  console.log(`  Matters: ${counts[1]}`)
  console.log(`  Fee Entries: ${counts[2]}`)
  console.log(`  Invoices: ${counts[3]}`)
  console.log(`  Invoice Line Items: ${counts[4]}`)
  console.log(`  Posting Codes: ${counts[5]}`)
  console.log('\n=== Import Complete ===')
}

main()
  .catch((e) => {
    console.error('Import failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
