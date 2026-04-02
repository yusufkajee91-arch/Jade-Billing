import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/matter-ledger')

// GET /api/reports/matter-ledger?matterId=&from=&to=
// Returns trust entries for a matter with opening balance and running balance.
export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('Unauthorized request — no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const matterId = searchParams.get('matterId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    log.debug('Query params:', { matterId, from: fromParam, to: toParam })

    if (!matterId) {
      log.warn('Missing required param: matterId')
      return NextResponse.json({ error: 'matterId is required' }, { status: 400 })
    }

    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      select: {
        id: true,
        matterCode: true,
        description: true,
        client: { select: { clientCode: true, clientName: true } },
      },
    })
    if (!matter) {
      log.warn('Matter not found', { matterId })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }

    // Check access
    if (session.user.role !== 'admin') {
      const access = await prisma.matterUser.findFirst({
        where: { matterId, userId: session.user.id },
      })
      const isOwner = await prisma.matter.findFirst({ where: { id: matterId, ownerId: session.user.id } })
      if (!access && !isOwner) {
        log.warn('Forbidden — user has no access to matter', { matterId, userId: session.user.id })
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const dateFrom = fromParam ? new Date(fromParam) : undefined
    const dateTo = toParam ? new Date(toParam) : undefined

    // Opening balance: all entries BEFORE the from date
    let openingBalanceCents = 0
    if (dateFrom) {
      const openingRows = await prisma.trustEntry.findMany({
        where: { matterId, entryDate: { lt: dateFrom } },
        select: { entryType: true, amountCents: true },
      })
      for (const row of openingRows) {
        if (['trust_receipt', 'trust_transfer_in', 'collection_receipt'].includes(row.entryType)) {
          openingBalanceCents += row.amountCents
        } else {
          openingBalanceCents -= row.amountCents
        }
      }
      log.debug('Opening balance computed:', { openingRows: openingRows.length, openingBalanceCents })
    }

    // In-period entries
    const entries = await prisma.trustEntry.findMany({
      where: {
        matterId,
        ...(dateFrom || dateTo
          ? { entryDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
          : {}),
      },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        entryDate: true,
        entryType: true,
        narration: true,
        referenceNumber: true,
        amountCents: true,
      },
    })
    log.debug('In-period trust entries fetched:', { count: entries.length })

    // Build running balance
    let runningBalance = openingBalanceCents
    const rows = entries.map((entry) => {
      const isInflow = ['trust_receipt', 'trust_transfer_in', 'collection_receipt'].includes(entry.entryType)
      const signedAmountCents = isInflow ? entry.amountCents : -entry.amountCents
      runningBalance += signedAmountCents
      return {
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        entryType: entry.entryType,
        narration: entry.narration,
        referenceNumber: entry.referenceNumber,
        debitCents: isInflow ? entry.amountCents : 0,   // money IN (trust receipt = debit)
        creditCents: isInflow ? 0 : entry.amountCents,  // money OUT (trust payment = credit)
        balanceCents: runningBalance,
      }
    })

    log.info('GET completed successfully', { matterCode: matter.matterCode, entryCount: rows.length, openingBalanceCents, closingBalanceCents: runningBalance })
    return NextResponse.json({
      matter,
      openingBalanceCents,
      closingBalanceCents: runningBalance,
      entries: rows,
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
