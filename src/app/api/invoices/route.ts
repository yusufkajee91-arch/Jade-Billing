import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { claimInvoiceNumber } from '@/lib/invoice-number'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('invoices')

const createInvoiceSchema = z.object({
  matterId: z.string().min(1),
  feeEntryIds: z.array(z.string()).min(1, 'Select at least one entry'),
  invoiceType: z.enum(['pro_forma', 'invoice']),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const invoiceListSelect = {
  id: true,
  invoiceNumber: true,
  invoiceType: true,
  status: true,
  invoiceDate: true,
  clientName: true,
  matterCode: true,
  matterDescription: true,
  subTotalCents: true,
  vatCents: true,
  totalCents: true,
  sentAt: true,
  paidAt: true,
  createdAt: true,
  matter: { select: { id: true, matterCode: true, description: true } },
  client: { select: { id: true, clientCode: true, clientName: true } },
} as const

export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const matterId = searchParams.get('matterId')
  const statusFilter = searchParams.get('status') // 'unsent' | 'all'
  log.debug('GET query params:', { matterId, status: statusFilter })

  try {
    const where: Record<string, unknown> = {}
    if (matterId) where.matterId = matterId
    if (statusFilter === 'unsent') {
      where.status = { in: ['draft_pro_forma', 'draft_invoice'] }
    }

    // Non-admin only sees their own matter invoices
    if (session.user.role !== 'admin') {
      where.matter = { OR: [{ ownerId: session.user.id }, { matterUsers: { some: { userId: session.user.id } } }] }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: invoiceListSelect,
      orderBy: { createdAt: 'desc' },
    })

    log.info('GET completed successfully', { count: invoices.length })
    return NextResponse.json(invoices)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json()
    log.debug('POST body:', body)
    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { matterId, feeEntryIds, invoiceType, invoiceDate } = parsed.data
    log.debug('POST parsed data:', { matterId, feeEntryCount: feeEntryIds.length, invoiceType, invoiceDate })

    // Load matter with client + owner
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      include: {
        client: true,
        owner: { select: { firstName: true, lastName: true, initials: true } },
      },
    })
    if (!matter) {
      log.warn('POST matter not found', { matterId })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }

    // Load firm settings (snapshot)
    const firm = await prisma.firmSettings.findFirst({
      include: { offices: { where: { isPrimary: true }, take: 1 } },
    })
    if (!firm) {
      log.warn('POST firm settings not found')
      return NextResponse.json({ error: 'Firm settings not found' }, { status: 404 })
    }

    // Load the selected fee entries
    const entries = await prisma.feeEntry.findMany({
      where: {
        id: { in: feeEntryIds },
        matterId,
        isInvoiced: false,
        isBillable: true,
      },
      include: {
        feeEarner: { select: { firstName: true, lastName: true, initials: true } },
        postingCode: { select: { code: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    })
    log.debug('POST billable entries found:', { requested: feeEntryIds.length, found: entries.length })

    if (entries.length === 0) {
      log.warn('POST no billable entries found', { feeEntryIds })
      return NextResponse.json({ error: 'No billable entries found for the selected IDs' }, { status: 400 })
    }

    // Calculate totals
    const subTotalCents = entries.reduce((s, e) => s + e.totalCents, 0)
    const vatCents = firm.vatRegistered
      ? Math.round((subTotalCents * firm.vatRateBps) / 10000)
      : 0
    const totalCents = subTotalCents + vatCents
    log.debug('POST totals:', { subTotalCents, vatCents, totalCents })

    // Claim atomic invoice number
    const { number: invoiceNumber } = await claimInvoiceNumber()
    log.debug('POST claimed invoice number:', invoiceNumber)

    // Build firm address snapshot
    const primaryOffice = firm.offices[0]
    const firmAddress = primaryOffice
      ? [primaryOffice.addressLine1, primaryOffice.addressLine2, primaryOffice.city, primaryOffice.province]
          .filter(Boolean)
          .join(', ')
      : null

    // Create invoice + line items atomically
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType,
        status: invoiceType === 'pro_forma' ? 'draft_pro_forma' : 'draft_invoice',
        matterId,
        clientId: matter.clientId,
        matterCode: matter.matterCode,
        matterDescription: matter.description,
        clientName: matter.client.clientName,
        clientEmail: matter.client.emailInvoices || matter.client.emailGeneral || null,
        firmName: firm.firmName,
        firmAddress,
        firmTel: primaryOffice?.tel ?? null,
        firmEmail: primaryOffice?.email ?? null,
        vatRegistered: firm.vatRegistered,
        vatRateBps: firm.vatRateBps,
        vatRegNumber: firm.vatRegistrationNumber ?? null,
        trustBankName: firm.trustBankName ?? null,
        trustBankAccountName: firm.trustBankAccountName ?? null,
        trustBankAccountNumber: firm.trustBankAccountNumber ?? null,
        trustBankBranchCode: firm.trustBankBranchCode ?? null,
        trustBankSwift: firm.trustBankSwift ?? null,
        invoicePaymentInstructions: firm.invoicePaymentInstructions ?? null,
        subTotalCents,
        vatCents,
        totalCents,
        invoiceDate: new Date(invoiceDate),
        createdById: session.user.id,
        lineItems: {
          create: entries.map((entry, i) => ({
            feeEntryId: entry.id,
            entryDate: entry.entryDate,
            entryType: entry.entryType,
            costCentre:
              entry.entryType === 'disbursement'
                ? 'Disbursements'
                : `${entry.feeEarner.firstName} ${entry.feeEarner.lastName}`,
            description: entry.narration,
            durationMinutesBilled: entry.durationMinutesBilled,
            unitQuantityThousandths: entry.unitQuantityThousandths,
            rateCents: entry.entryType === 'disbursement' ? entry.totalCents : entry.rateCents,
            amountCents: entry.amountCents,
            discountPct: entry.discountPct,
            discountCents: entry.discountCents,
            totalCents: entry.totalCents,
            sortOrder: i,
          })),
        },
      },
      include: { lineItems: true },
    })

    // Mark entries as invoiced
    await prisma.feeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { isInvoiced: true },
    })

    log.info('POST completed successfully', { invoiceId: invoice.id, invoiceNumber, totalCents })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
