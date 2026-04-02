import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('clients/[id]/statement')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  log.debug('GET params:', { id, from: fromParam, to: toParam })

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, clientCode: true, clientName: true, emailStatements: true },
    })
    if (!client) {
      log.warn('GET client not found', { id })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const dateFrom = fromParam ? new Date(fromParam) : undefined
    const dateTo = toParam ? new Date(toParam) : undefined

    // Invoices: sent_invoice + paid
    const invoices = await prisma.invoice.findMany({
      where: {
        clientId: id,
        status: { in: ['sent_invoice', 'paid'] },
        ...(dateFrom || dateTo
          ? { invoiceDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        matterCode: true,
        matterDescription: true,
        invoiceDate: true,
        totalCents: true,
        status: true,
      },
      orderBy: { invoiceDate: 'asc' },
    })
    log.debug('GET invoices found:', { count: invoices.length })

    // Receipts: matter_receipt BusinessEntries for this client's matters
    const receipts = await prisma.businessEntry.findMany({
      where: {
        entryType: 'matter_receipt',
        matter: { clientId: id },
        ...(dateFrom || dateTo
          ? { entryDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
          : {}),
      },
      select: {
        id: true,
        referenceNumber: true,
        narration: true,
        entryDate: true,
        amountCents: true,
        matter: { select: { matterCode: true } },
      },
      orderBy: { entryDate: 'asc' },
    })
    log.debug('GET receipts found:', { count: receipts.length })

    // Merge and sort by date
    type StatementEntry = {
      date: string
      type: 'invoice' | 'receipt'
      reference: string
      description: string
      debitCents: number
      creditCents: number
      balanceCents: number
    }

    const rows: Omit<StatementEntry, 'balanceCents'>[] = [
      ...invoices.map(inv => ({
        date: inv.invoiceDate.toISOString().slice(0, 10),
        type: 'invoice' as const,
        reference: inv.invoiceNumber,
        description: `${inv.matterCode} — ${inv.matterDescription}`,
        debitCents: inv.totalCents,
        creditCents: 0,
      })),
      ...receipts.map(r => ({
        date: r.entryDate.toISOString().slice(0, 10),
        type: 'receipt' as const,
        reference: r.referenceNumber ?? r.id.slice(0, 8).toUpperCase(),
        description: r.narration ?? `Payment received — ${r.matter?.matterCode ?? ''}`,
        debitCents: 0,
        creditCents: r.amountCents,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    // Build running balance
    let balance = 0
    const entries: StatementEntry[] = rows.map(row => {
      balance += row.debitCents - row.creditCents
      return { ...row, balanceCents: balance }
    })

    const totalDebit = entries.reduce((s, e) => s + e.debitCents, 0)
    const totalCredit = entries.reduce((s, e) => s + e.creditCents, 0)

    log.info('GET completed successfully', { clientCode: client.clientCode, entryCount: entries.length })
    return NextResponse.json({
      client,
      entries,
      totals: {
        debitCents: totalDebit,
        creditCents: totalCredit,
        closingBalanceCents: totalDebit - totalCredit,
      },
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
