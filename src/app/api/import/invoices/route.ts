import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { matchFeeEarner } from '@/lib/import-utils'
import { apiLogger } from '@/lib/debug'
import * as XLSX from 'xlsx'

const log = apiLogger('import/invoices')

function str(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  return String(val).trim()
}

function num(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function toCents(val: unknown): number {
  return Math.round(num(val) * 100)
}

function parseDate(val: unknown): Date {
  if (!val) return new Date()
  let d: Date
  if (val instanceof Date) {
    d = val
  } else if (typeof val === 'number') {
    // Excel serial date → UTC midnight
    const MS_PER_DAY = 86400000
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
    return new Date(EXCEL_EPOCH + val * MS_PER_DAY)
  } else {
    d = new Date(String(val))
    if (isNaN(d.getTime())) return new Date()
  }
  // Normalize to UTC midnight to avoid timezone date shifts
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

interface RawRow {
  'Date Invoiced'?: unknown
  'Year + Month'?: unknown
  'Reference'?: unknown
  'Date'?: unknown
  'Customer'?: unknown
  'Matter Name'?: unknown
  'Matter Code'?: unknown
  'Client Ref'?: unknown
  'Department'?: unknown
  'Fee Earner'?: unknown
  'Narration'?: unknown
  'Qty'?: unknown
  'Unit Price'?: unknown
  'Minutes'?: unknown
  'Posting Code'?: unknown
  'DISBURSEMENTS Amount'?: unknown
  'FEES Amount'?: unknown
  'vat Amount'?: unknown
  [key: string]: unknown
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('Unauthorized request — no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('Forbidden — user role is not admin', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      log.warn('Invalid request — expected multipart/form-data')
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      log.warn('Missing or invalid file field')
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const buffer = await (file as File).arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      log.warn('No sheets found in uploaded file')
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 422 })
    }
    const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName]!)
    log.debug('File parsed:', { sheetName, rowCount: rows.length })

    if (rows.length === 0) {
      log.warn('No data rows found in file')
      return NextResponse.json({ error: 'No data rows found' }, { status: 422 })
    }

    // ── Group rows by Reference (invoice number) ──────────────────────────────
    const invoiceGroups = new Map<string, RawRow[]>()
    for (const row of rows) {
      const ref = str(row['Reference'])
      if (!ref) continue
      if (!invoiceGroups.has(ref)) invoiceGroups.set(ref, [])
      invoiceGroups.get(ref)!.push(row)
    }
    log.debug('Invoice groups formed:', { groupCount: invoiceGroups.size })

    // ── Load lookup data ──────────────────────────────────────────────────────
    const matters = await prisma.matter.findMany({
      select: { id: true, matterCode: true, description: true, clientId: true, client: { select: { id: true, clientName: true, emailGeneral: true } } },
    })
    const matterMap = new Map(matters.map(m => [m.matterCode, m]))

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    })

    const existingInvoices = await prisma.invoice.findMany({ select: { invoiceNumber: true } })
    const existingNumbers = new Set(existingInvoices.map(i => i.invoiceNumber))

    // Load firm settings for snapshot fields
    const firm = await prisma.firmSettings.findFirst({
      include: { offices: { where: { isPrimary: true }, take: 1 } },
    })
    const primaryOffice = firm?.offices[0]
    const firmAddress = primaryOffice
      ? [primaryOffice.addressLine1, primaryOffice.addressLine2, primaryOffice.city, primaryOffice.province]
          .filter(Boolean)
          .join(', ')
      : null
    log.debug('Lookup data loaded:', { matters: matters.length, users: users.length, existingInvoices: existingInvoices.length })

    // ── Process each invoice group ────────────────────────────────────────────
    let invoicesImported = 0
    let lineItemsImported = 0
    let skippedDuplicate = 0
    const skippedNoMatter: string[] = []
    const errors: string[] = []

    for (const [reference, groupRows] of invoiceGroups) {
      try {
        // Skip duplicates
        if (existingNumbers.has(reference)) {
          skippedDuplicate++
          continue
        }

        const firstRow = groupRows[0]!

        // Find matter — strip spaces so "JJ / EDS-001" matches "JJ/EDS-001"
        let matterCode = str(firstRow['Matter Code'])
        if (!matterCode) {
          skippedNoMatter.push(`(empty) — ${reference}`)
          continue
        }
        matterCode = matterCode.replace(/\s/g, '')

        const matter = matterMap.get(matterCode)
        if (!matter) {
          if (!skippedNoMatter.includes(matterCode)) {
            skippedNoMatter.push(matterCode)
          }
          continue
        }

        // Fuzzy match fee earner
        const createdById = matchFeeEarner(str(firstRow['Fee Earner']), users, session.user.id)

        // Calculate totals from line items
        let subTotalCents = 0
        let vatCents = 0

        const lineItems: {
          entryDate: Date
          entryType: string
          costCentre: string
          description: string
          unitQuantityThousandths: number | null
          rateCents: number
          amountCents: number
          totalCents: number
          sortOrder: number
        }[] = []

        for (let li = 0; li < groupRows.length; li++) {
          const lineRow = groupRows[li]!
          const disbAmount = num(lineRow['DISBURSEMENTS Amount'])
          const feesAmount = num(lineRow['FEES Amount'])
          const vatAmount = num(lineRow['vat Amount'])

          const lineAmountCents = toCents(disbAmount !== 0 ? disbAmount : feesAmount)
          const lineVatCents = toCents(vatAmount)

          subTotalCents += lineAmountCents
          vatCents += lineVatCents

          const entryType = disbAmount !== 0 ? 'disbursement' : 'time'
          const qty = num(lineRow['Qty'])
          const unitPriceCents = toCents(lineRow['Unit Price'])

          lineItems.push({
            entryDate: parseDate(lineRow['Date']),
            entryType,
            costCentre: str(lineRow['Posting Code']) || 'IMPORT',
            description: str(lineRow['Narration']) || reference,
            unitQuantityThousandths: qty ? Math.round(qty * 1000) : null,
            rateCents: unitPriceCents,
            amountCents: lineAmountCents,
            totalCents: lineAmountCents,
            sortOrder: li,
          })
        }

        const totalCents = subTotalCents + vatCents
        const invoiceDate = parseDate(firstRow['Date Invoiced'])

        await prisma.invoice.create({
          data: {
            invoiceNumber: reference,
            invoiceType: 'invoice' as never,
            status: 'sent_invoice' as never,
            matterId: matter.id,
            clientId: matter.clientId,
            // Snapshot fields
            matterCode: matter.matterCode,
            matterDescription: matter.description,
            clientName: matter.client.clientName,
            clientEmail: matter.client.emailGeneral,
            firmName: firm?.firmName ?? 'Imported',
            firmAddress,
            firmTel: primaryOffice?.tel,
            firmEmail: primaryOffice?.email,
            firmWebsite: primaryOffice?.website,
            vatRegistered: firm?.vatRegistered ?? false,
            vatRateBps: firm?.vatRateBps ?? 1500,
            vatRegNumber: firm?.vatRegistrationNumber,
            trustBankName: firm?.trustBankName,
            trustBankAccountName: firm?.trustBankAccountName,
            trustBankAccountNumber: firm?.trustBankAccountNumber,
            trustBankBranchCode: firm?.trustBankBranchCode,
            trustBankSwift: firm?.trustBankSwift,
            invoicePaymentInstructions: firm?.invoicePaymentInstructions,
            // Financials
            subTotalCents,
            vatCents,
            totalCents,
            invoiceDate,
            sentAt: invoiceDate,
            isHistorical: true,
            createdById,
            lineItems: {
              create: lineItems,
            },
          },
        })

        existingNumbers.add(reference)
        invoicesImported++
        lineItemsImported += lineItems.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${reference}: ${msg}`)
      }
    }

    log.info('POST completed successfully', { invoicesImported, lineItemsImported, skippedDuplicate, skippedNoMatter: skippedNoMatter.length, errorCount: errors.length })
    return NextResponse.json({
      invoices_imported: invoicesImported,
      line_items_imported: lineItemsImported,
      skipped_no_matter: skippedNoMatter,
      skipped_duplicate: skippedDuplicate,
      errors,
    })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
