import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'
import { getWorkingDaysInMonth, cumulativeWorkingDays } from '@/lib/working-days'
import {
  bucketBilledInvoicesByDay,
  bucketFeeEntriesByDay,
  buildCumulativeSeries,
  type BilledInvoiceForChart,
} from '@/lib/dashboard-fees'

const log = apiLogger('dashboard/fees-chart')

// GET /api/dashboard/fees-chart?scope=mine|all
// Returns daily cumulative recorded + billed fee data for current month + previous month.
export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET rejected: unauthorised')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const scope = searchParams.get('scope') ?? 'mine'
  const isAdmin = session.user.role === 'admin'
  log.debug('Query params:', { scope, isAdmin })

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const currentStart = new Date(Date.UTC(year, month, 1))
  const currentEndExclusive = new Date(Date.UTC(year, month + 1, 1))
  const daysInCurrent = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1))
  const prevEndExclusive = new Date(Date.UTC(prevYear, prevMonth + 1, 1))
  const daysInPrev = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate()

  const earnerFilter = scope === 'all' && isAdmin ? {} : { feeEarnerId: session.user.id }

  try {
    // Resolve target for this scope
    let monthlyTargetCents: number | null = null
    if (scope === 'all' && isAdmin) {
      // Sum all active users' targets; null only if every user has no target
      const earners = await prisma.user.findMany({
        where: { isActive: true, monthlyTargetCents: { not: null } },
        select: { monthlyTargetCents: true },
      })
      if (earners.length > 0) {
        monthlyTargetCents = earners.reduce((s, u) => s + (u.monthlyTargetCents ?? 0), 0)
      }
    } else {
      const me = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { monthlyTargetCents: true },
      })
      monthlyTargetCents = me?.monthlyTargetCents ?? null
    }

    const billableFilter = { isBillable: true, entryType: { not: 'disbursement' as const } }

    const invoiceSelect = {
      sentAt: true,
      invoiceDate: true,
      lineItems: {
        select: {
          entryType: true,
          totalCents: true,
          feeEntryId: true,
        },
      },
    }

    const [currentEntries, prevEntries, currentBilledInvoices, prevBilledInvoices] = await Promise.all([
      prisma.feeEntry.findMany({
        where: { ...earnerFilter, ...billableFilter, entryDate: { gte: currentStart, lt: currentEndExclusive } },
        select: { entryDate: true, totalCents: true },
      }),
      prisma.feeEntry.findMany({
        where: { ...earnerFilter, ...billableFilter, entryDate: { gte: prevStart, lt: prevEndExclusive } },
        select: { entryDate: true, totalCents: true },
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
        select: invoiceSelect,
      }),
      prisma.invoice.findMany({
        where: {
          invoiceType: 'invoice',
          status: { in: ['sent_invoice', 'paid'] },
          OR: [
            { sentAt: { gte: prevStart, lt: prevEndExclusive } },
            { sentAt: null, invoiceDate: { gte: prevStart, lt: prevEndExclusive } },
          ],
        },
        select: invoiceSelect,
      }),
    ])

    let scopedFeeEntryIds: Set<string> | undefined
    if (!(scope === 'all' && isAdmin)) {
      const billedFeeEntryIds = Array.from(new Set(
        [...currentBilledInvoices, ...prevBilledInvoices]
          .flatMap((invoice) => invoice.lineItems.map((lineItem) => lineItem.feeEntryId))
          .filter((id): id is string => Boolean(id)),
      ))

      const scopedEntries = billedFeeEntryIds.length
        ? await prisma.feeEntry.findMany({
            where: { id: { in: billedFeeEntryIds }, feeEarnerId: session.user.id },
            select: { id: true },
          })
        : []
      scopedFeeEntryIds = new Set(scopedEntries.map((entry) => entry.id))
    }

    const currMap = bucketFeeEntriesByDay(currentEntries)
    const prevMap = bucketFeeEntriesByDay(prevEntries)
    const billedCurrMap = bucketBilledInvoicesByDay(
      currentBilledInvoices as BilledInvoiceForChart[],
      scopedFeeEntryIds,
    )
    const billedPrevMap = bucketBilledInvoicesByDay(
      prevBilledInvoices as BilledInvoiceForChart[],
      scopedFeeEntryIds,
    )

    // Daily target spread across working days (excl. weekends + SA public holidays)
    const workingDays = getWorkingDaysInMonth(year, month)
    const dailyTargetCents = monthlyTargetCents != null && workingDays > 0
      ? monthlyTargetCents / workingDays
      : null

    const targetForDay = dailyTargetCents != null
      ? (d: number) => {
        if (d > daysInCurrent) return undefined
        const wd = cumulativeWorkingDays(year, month, d)
        return Math.round(dailyTargetCents * wd)
      }
      : undefined

    const recordedData = buildCumulativeSeries({
      daysInCurrent,
      daysInPrevious: daysInPrev,
      today,
      currentMap: currMap,
      previousMap: prevMap,
      targetForDay,
    })
    const billedData = buildCumulativeSeries({
      daysInCurrent,
      daysInPrevious: daysInPrev,
      today,
      currentMap: billedCurrMap,
      previousMap: billedPrevMap,
      targetForDay,
    })

    log.debug('Fees chart data:', {
      dataPoints: recordedData.length,
      billedDataPoints: billedData.length,
      monthlyTargetCents,
    })
    log.info('GET completed successfully')
    return NextResponse.json({
      data: recordedData,
      series: {
        recorded: recordedData,
        billed: billedData,
      },
      today,
      daysInCurrentMonth: daysInCurrent,
      monthlyTargetCents,
      currentMonthName: currentStart.toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' }),
      previousMonthName: prevStart.toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' }),
    })
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
