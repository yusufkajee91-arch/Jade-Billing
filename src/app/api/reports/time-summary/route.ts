import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/time-summary')

// GET /api/reports/time-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&earnerId=UUID
// Detailed time recording entries for the period, optionally filtered by earner.
export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('Unauthorized request — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const earnerId = searchParams.get('earnerId')
  const isAdmin = session.user.role === 'admin'
  log.debug('Query params:', { from, to, earnerId, isAdmin })

  // Non-admins can only see their own entries
  const resolvedEarnerId = isAdmin ? (earnerId ?? undefined) : session.user.id

  const dateFilter =
    from || to
      ? { entryDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}

  try {
    const entries = await prisma.feeEntry.findMany({
      where: {
        ...dateFilter,
        ...(resolvedEarnerId ? { feeEarnerId: resolvedEarnerId } : {}),
      },
      select: {
        id: true,
        entryDate: true,
        entryType: true,
        narration: true,
        durationMinutesBilled: true,
        totalCents: true,
        isBillable: true,
        isInvoiced: true,
        matter: { select: { matterCode: true, description: true, client: { select: { clientName: true } } } },
        feeEarner: { select: { initials: true, firstName: true, lastName: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { matter: { matterCode: 'asc' } }],
    })
    log.debug('Fee entries fetched:', { count: entries.length })

    const totals = entries.reduce(
      (acc, e) => ({
        totalMinutes: acc.totalMinutes + (e.durationMinutesBilled ?? 0),
        totalCents: acc.totalCents + e.totalCents,
        billableMinutes: acc.billableMinutes + (e.isBillable ? (e.durationMinutesBilled ?? 0) : 0),
        billableCents: acc.billableCents + (e.isBillable ? e.totalCents : 0),
      }),
      { totalMinutes: 0, totalCents: 0, billableMinutes: 0, billableCents: 0 },
    )

    // Fetch fee earners list for the filter dropdown (admin only)
    const feeEarners = isAdmin
      ? await prisma.user.findMany({
          where: { isActive: true, role: { in: ['admin', 'fee_earner'] } },
          select: { id: true, firstName: true, lastName: true, initials: true },
          orderBy: { firstName: 'asc' },
        })
      : []

    log.info('GET completed successfully', { entryCount: entries.length, totalCents: totals.totalCents, billableCents: totals.billableCents })
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        entryDate: new Date(e.entryDate).toISOString().slice(0, 10),
        entryType: e.entryType,
        narration: e.narration,
        durationMinutesBilled: e.durationMinutesBilled,
        totalCents: e.totalCents,
        isBillable: e.isBillable,
        isInvoiced: e.isInvoiced,
        matterCode: e.matter.matterCode,
        matterDescription: e.matter.description,
        clientName: e.matter.client.clientName,
        earnerInitials: e.feeEarner.initials,
        earnerName: `${e.feeEarner.firstName} ${e.feeEarner.lastName}`,
      })),
      totals,
      feeEarners,
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
