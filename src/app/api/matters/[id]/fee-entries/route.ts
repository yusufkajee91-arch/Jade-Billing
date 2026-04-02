import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters/[id]/fee-entries')

const feeEntrySelect = {
  id: true,
  matterId: true,
  entryType: true,
  entryDate: true,
  narration: true,
  durationMinutesRaw: true,
  durationMinutesBilled: true,
  unitQuantityThousandths: true,
  rateCents: true,
  amountCents: true,
  discountPct: true,
  discountCents: true,
  totalCents: true,
  isBillable: true,
  isInvoiced: true,
  receiptFileName: true,
  postingCodeId: true,
  feeEarnerId: true,
  createdAt: true,
  updatedAt: true,
  feeEarner: {
    select: { id: true, firstName: true, lastName: true, initials: true },
  },
  postingCode: {
    select: { id: true, code: true, description: true },
  },
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id: matterId } = await params

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') // 'fees' | 'disbursements' | 'all' | undefined
    const billable = searchParams.get('billable') // 'true' | 'false' | null
    log.debug('GET params:', { matterId, tab, billable })

    const where: Record<string, unknown> = { matterId, isInvoiced: false }

    if (tab === 'fees') {
      where.entryType = { in: ['time', 'unitary'] }
    } else if (tab === 'disbursements') {
      where.entryType = 'disbursement'
    }

    if (billable === 'true') where.isBillable = true
    if (billable === 'false') where.isBillable = false

    const entries = await prisma.feeEntry.findMany({
      where,
      select: feeEntrySelect,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    })

    // Summary totals
    const allUnbilled = await prisma.feeEntry.findMany({
      where: { matterId, isInvoiced: false },
      select: { entryType: true, totalCents: true, isBillable: true },
    })

    const summary = allUnbilled.reduce(
      (acc, e) => {
        if (!e.isBillable) return acc
        if (e.entryType === 'time' || e.entryType === 'unitary') {
          acc.feesCents += e.totalCents
        } else {
          acc.disbCents += e.totalCents
        }
        return acc
      },
      { feesCents: 0, disbCents: 0 },
    )

    log.info(`GET completed, returning ${entries.length} fee entries for matter ${matterId}`, { summary })
    return NextResponse.json({ entries, summary })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
