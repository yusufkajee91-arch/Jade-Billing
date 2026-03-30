import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/fees-chart?scope=mine|all
// Returns daily cumulative fee data for current month + previous month.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') ?? 'mine'
  const isAdmin = session.user.role === 'admin'

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const currentStart = new Date(Date.UTC(year, month, 1))
  const currentEnd = new Date(Date.UTC(year, month + 1, 0))
  const daysInCurrent = currentEnd.getUTCDate()

  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1))
  const prevEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0))
  const daysInPrev = prevEnd.getUTCDate()

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

    const [currentEntries, prevEntries] = await Promise.all([
      prisma.feeEntry.findMany({
        where: { ...earnerFilter, entryDate: { gte: currentStart, lte: currentEnd } },
        select: { entryDate: true, totalCents: true },
      }),
      prisma.feeEntry.findMany({
        where: { ...earnerFilter, entryDate: { gte: prevStart, lte: prevEnd } },
        select: { entryDate: true, totalCents: true },
      }),
    ])

    // Aggregate by UTC day number
    const byDay = (entries: { entryDate: Date; totalCents: number }[]) => {
      const map = new Map<number, number>()
      for (const e of entries) {
        const d = new Date(e.entryDate).getUTCDate()
        map.set(d, (map.get(d) ?? 0) + e.totalCents)
      }
      return map
    }

    const currMap = byDay(currentEntries)
    const prevMap = byDay(prevEntries)

    // Daily target = monthly target spread evenly across the month's days
    const dailyTargetCents = monthlyTargetCents != null ? monthlyTargetCents / daysInCurrent : null

    type DayData = { day: number; current: number; previous: number; target?: number }
    const data: DayData[] = []
    const maxDays = Math.max(daysInCurrent, daysInPrev)
    let currCum = 0
    let prevCum = 0

    for (let d = 1; d <= maxDays; d++) {
      if (d <= daysInCurrent && d <= today) currCum += currMap.get(d) ?? 0
      if (d <= daysInPrev) prevCum += prevMap.get(d) ?? 0
      const point: DayData = {
        day: d,
        current: d <= today && d <= daysInCurrent ? currCum : 0,
        previous: d <= daysInPrev ? prevCum : 0,
      }
      if (dailyTargetCents != null) {
        point.target = Math.round(dailyTargetCents * d)
      }
      data.push(point)
    }

    return NextResponse.json({
      data,
      today,
      daysInCurrentMonth: daysInCurrent,
      monthlyTargetCents,
      currentMonthName: currentStart.toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' }),
      previousMonthName: prevStart.toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' }),
    })
  } catch (err) {
    console.error('[GET /api/dashboard/fees-chart]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
