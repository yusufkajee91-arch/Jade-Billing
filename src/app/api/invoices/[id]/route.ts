import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { InvoiceStatus } from '@/generated/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('invoices/[id]')

// Valid state transitions
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft_pro_forma: ['sent_pro_forma', 'draft_invoice'],
  sent_pro_forma: ['draft_invoice'],
  draft_invoice: ['sent_invoice'],
  sent_invoice: ['paid'],
  paid: [],
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('transition'), status: z.enum(['sent_pro_forma', 'draft_invoice', 'sent_invoice', 'paid']) }),
  z.object({ action: z.literal('mark_paid'), paidNote: z.string().optional() }),
])

const invoiceFullSelect = {
  id: true,
  invoiceNumber: true,
  invoiceType: true,
  status: true,
  invoiceDate: true,
  sentAt: true,
  paidAt: true,
  paidNote: true,
  clientName: true,
  clientEmail: true,
  matterCode: true,
  matterDescription: true,
  firmName: true,
  firmAddress: true,
  firmTel: true,
  firmEmail: true,
  firmWebsite: true,
  vatRegistered: true,
  vatRateBps: true,
  vatRegNumber: true,
  trustBankName: true,
  trustBankAccountName: true,
  trustBankAccountNumber: true,
  trustBankBranchCode: true,
  trustBankSwift: true,
  invoicePaymentInstructions: true,
  subTotalCents: true,
  vatCents: true,
  totalCents: true,
  createdAt: true,
  matter: { select: { id: true, matterCode: true, description: true } },
  client: { select: { id: true, clientCode: true, clientName: true } },
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('GET invoice id:', id)

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id }, select: invoiceFullSelect })
    if (!invoice) {
      log.warn('GET invoice not found', { id })
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    log.info('GET completed successfully', { invoiceNumber: invoice.invoiceNumber })
    return NextResponse.json(invoice)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('PATCH unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('PATCH invoice id:', id)

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, invoiceType: true } })
    if (!invoice) {
      log.warn('PATCH invoice not found', { id })
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const body = await request.json()
    log.debug('PATCH body:', body)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('PATCH validation failed:', parsed.error.flatten())
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const currentStatus = invoice.status as InvoiceStatus
    let newStatus: InvoiceStatus
    const updateData: Record<string, unknown> = {}

    if (parsed.data.action === 'mark_paid') {
      if (currentStatus !== 'sent_invoice') {
        log.warn('PATCH invalid transition - mark_paid on non-sent invoice', { currentStatus })
        return NextResponse.json({ error: 'Only sent invoices can be marked paid' }, { status: 409 })
      }
      newStatus = 'paid'
      updateData.paidAt = new Date()
      updateData.paidNote = parsed.data.paidNote ?? null
    } else {
      newStatus = parsed.data.status as InvoiceStatus
      if (!TRANSITIONS[currentStatus].includes(newStatus)) {
        log.warn('PATCH invalid status transition', { currentStatus, newStatus })
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
          { status: 409 },
        )
      }
      if (newStatus === 'sent_pro_forma' || newStatus === 'sent_invoice') {
        updateData.sentAt = new Date()
      }
    }

    updateData.status = newStatus
    log.debug('PATCH updating invoice:', { currentStatus, newStatus })
    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      select: invoiceFullSelect,
    })

    log.info('PATCH completed successfully', { invoiceNumber: updated.invoiceNumber, newStatus })
    return NextResponse.json(updated)
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
