import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'
import {
  bucketBilledInvoicesByEarnerDay,
  buildEarnerCumulativeData,
  type BilledInvoiceForChart,
} from '@/lib/dashboard-fees'

const log = apiLogger('dashboard/fees-chart-earners')

const EARNER_COLORS = [
  'hsl(10 22% 60%)',
  'hsl(225 28% 64%)',
  'hsl(142 25% 42%)',
  'hsl(35 55% 50%)',
  'hsl(270 25% 55%)',
  'hsl(190 40% 45%)',
  'hsl(0 45% 55%)',
  'hsl(60 30% 45%)',
]

// GET /api/dashboard/fees-chart-earners — admin only
// Returns per-earner daily cumulative recorded + billed fee data for the current month.
export async function GET() {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET rejected: unauthorised')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('GET rejected: forbidden', { role: session.user.role })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const currentStart = new Date(Date.UTC(year, month, 1))
  const currentEndExclusive = new Date(Date.UTC(year, month + 1, 1))
  const daysInCurrent = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  try {
    const [allUsers, feeEntries, billedInvoices] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, initials: true, firstName: true, monthlyTargetCents: true },
        orderBy: { initials: 'asc' },
      }),
      prisma.feeEntry.findMany({
        where: {
          entryDate: { gte: currentStart, lt: currentEndExclusive },
          isBillable: true,
          entryType: { not: 'disbursement' as const },
        },
        select: { feeEarnerId: true, entryDate: true, totalCents: true },
      }),
      prisma.invoice.findMany({
        where: {
          invoiceType: 'invoice',
          status: { in: ['sent_invoice', 'paid'] },
          OR: [
            { sentAt: { gte: currentStart, lt: currentEndExclusive } },
            { sentAt: null, invoiceDate: { gte: currentStart, lt: currentEndExclusive } },
          ],
        },
        select: {
          sentAt: true,
          invoiceDate: true,
          lineItems: {
            select: {
              entryType: true,
              totalCents: true,
              feeEntryId: true,
            },
          },
        },
      }),
    ])

    const billedFeeEntryIds = Array.from(new Set(
      billedInvoices
        .flatMap((invoice) => invoice.lineItems.map((lineItem) => lineItem.feeEntryId))
        .filter((id): id is string => Boolean(id)),
    ))
    const billedFeeEntries = billedFeeEntryIds.length
      ? await prisma.feeEntry.findMany({
          where: { id: { in: billedFeeEntryIds } },
          select: { id: true, feeEarnerId: true },
        })
      : []
    const billedFeeEntryEarnerIds = new Map(
      billedFeeEntries.map((entry) => [entry.id, entry.feeEarnerId]),
    )
    const billedEarnerIds = new Set(billedFeeEntries.map((entry) => entry.feeEarnerId))

    // Only include earners who have entries this month OR have a target set
    const earnerIdsWithEntries = new Set(feeEntries.map((e) => e.feeEarnerId))
    const activeEarners = allUsers.filter(
      (u) => earnerIdsWithEntries.has(u.id) || billedEarnerIds.has(u.id) || u.monthlyTargetCents != null,
    )

    // Build per-earner per-day sums
    const earnerDayMap = new Map<string, Map<number, number>>()
    for (const earner of activeEarners) earnerDayMap.set(earner.id, new Map())
    for (const entry of feeEntries) {
      const dayMap = earnerDayMap.get(entry.feeEarnerId)
      if (!dayMap) continue
      const d = new Date(entry.entryDate).getUTCDate()
      dayMap.set(d, (dayMap.get(d) ?? 0) + entry.totalCents)
    }

    const earnerIds = activeEarners.map((earner) => earner.id)
    const recordedData = buildEarnerCumulativeData({
      earnerIds,
      daysInCurrent,
      today,
      earnerDayMap,
    })
    const billedData = buildEarnerCumulativeData({
      earnerIds,
      daysInCurrent,
      today,
      earnerDayMap: bucketBilledInvoicesByEarnerDay(
        billedInvoices as BilledInvoiceForChart[],
        billedFeeEntryEarnerIds,
      ),
    })

    log.debug('Fees chart earners data:', {
      earnerCount: activeEarners.length,
      dataPoints: recordedData.length,
      billedDataPoints: billedData.length,
    })
    log.info('GET completed successfully')
    return NextResponse.json({
      earners: activeEarners.map((e, i) => ({
        id: e.id,
        initials: e.initials,
        name: e.firstName,
        monthlyTargetCents: e.monthlyTargetCents,
        color: EARNER_COLORS[i % EARNER_COLORS.length],
      })),
      data: recordedData,
      series: {
        recorded: recordedData,
        billed: billedData,
      },
      today,
      daysInCurrentMonth: daysInCurrent,
      currentMonthName: currentStart.toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' }),
    })
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
