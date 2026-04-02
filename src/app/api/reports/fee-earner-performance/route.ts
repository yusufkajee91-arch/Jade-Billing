import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/fee-earner-performance')

// GET /api/reports/fee-earner-performance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Fees recorded and billed per fee earner for the period.
export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('Unauthorized request — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('Forbidden — user role is not admin', { role: session.user.role })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  log.debug('Query params:', { from, to })

  const dateFilter =
    from || to
      ? { entryDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}

  try {
    const entries = await prisma.feeEntry.findMany({
      where: dateFilter,
      select: {
        isBillable: true,
        isInvoiced: true,
        durationMinutesBilled: true,
        totalCents: true,
        feeEarner: { select: { id: true, firstName: true, lastName: true, initials: true } },
      },
    })
    log.debug('Fee entries fetched:', { count: entries.length })

    type EarnerRow = {
      userId: string
      name: string
      initials: string
      totalMinutes: number
      recordedCents: number
      billedCents: number
      unbilledCents: number
      entryCount: number
    }

    const map = new Map<string, EarnerRow>()

    for (const e of entries) {
      const uid = e.feeEarner.id
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name: `${e.feeEarner.firstName} ${e.feeEarner.lastName}`,
          initials: e.feeEarner.initials,
          totalMinutes: 0,
          recordedCents: 0,
          billedCents: 0,
          unbilledCents: 0,
          entryCount: 0,
        })
      }
      const row = map.get(uid)!
      row.entryCount += 1
      row.totalMinutes += e.durationMinutesBilled ?? 0
      if (e.isBillable) {
        row.recordedCents += e.totalCents
        if (e.isInvoiced) row.billedCents += e.totalCents
        else row.unbilledCents += e.totalCents
      }
    }

    const earners = Array.from(map.values()).sort((a, b) => b.recordedCents - a.recordedCents)

    log.info('GET completed successfully', { earnerCount: earners.length })
    return NextResponse.json({ earners })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
