import './dashboard.css'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { pageLogger } from '@/lib/debug'

const log = pageLogger('dashboard')

export default async function DashboardPage() {
  log.info('Rendering dashboard page')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('No session found, redirecting to login')
    redirect('/login')
  }

  const userId = session.user.id
  const isAdmin = session.user.role === 'admin'
  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  log.debug('Dashboard user:', { userId, isAdmin, firstName })

  // ─── Date boundaries (SAST = UTC+2) ─────────────────────────────────────────
  const nowSAST = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const todayStr = nowSAST.toISOString().slice(0, 10) // YYYY-MM-DD in SAST
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)
  const weekEnd = new Date(todayStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 8)

  // Calendar month boundaries
  const [yearStr, monthStr] = todayStr.split('-')
  const monthStart = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`)
  const nextMonthStart = new Date(monthStart)
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1)

  // ─── Parallel data fetches ───────────────────────────────────────────────────
  log.debug('Fetching dashboard data in parallel')
  const [wipGroups, todayDiary, weekDiary, unsentInvoices, calendarDiary] = await Promise.all([
    prisma.feeEntry.groupBy({
      by: ['matterId'],
      where: { feeEarnerId: userId, isBillable: true, isInvoiced: false },
      _sum: { totalCents: true },
      orderBy: { _sum: { totalCents: 'desc' } },
      take: 10,
    }),
    prisma.diaryEntry.findMany({
      where: { assignedToId: userId, dueDate: { gte: todayStart, lt: tomorrowStart } },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        dueDate: true,
        matter: { select: { id: true, matterCode: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.diaryEntry.findMany({
      where: { assignedToId: userId, dueDate: { gte: tomorrowStart, lt: weekEnd } },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        dueDate: true,
        matter: { select: { id: true, matterCode: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.invoice.findMany({
      where: { createdById: userId, status: 'draft_invoice' },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        matterCode: true,
        totalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.diaryEntry.findMany({
      where: { assignedToId: userId, dueDate: { gte: monthStart, lt: nextMonthStart } },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        dueDate: true,
        matter: { select: { id: true, matterCode: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  // ─── Resolve matter details for WIP ─────────────────────────────────────────
  const wipMatterIds = wipGroups.map((g) => g.matterId)
  const wipMatters =
    wipMatterIds.length > 0
      ? await prisma.matter.findMany({
          where: { id: { in: wipMatterIds } },
          select: {
            id: true,
            matterCode: true,
            description: true,
            client: { select: { clientName: true } },
          },
        })
      : []
  const matterMap = new Map(wipMatters.map((m) => [m.id, m]))

  const wip = wipGroups
    .map((g) => ({
      matterId: g.matterId,
      totalCents: g._sum.totalCents ?? 0,
      matter: matterMap.get(g.matterId) ?? null,
    }))
    .filter(
      (w): w is { matterId: string; totalCents: number; matter: NonNullable<typeof w.matter> } =>
        w.totalCents > 0 && w.matter !== null,
    )

  const wipTotal = wip.reduce((s, w) => s + w.totalCents, 0)

  // ─── Admin KPIs ──────────────────────────────────────────────────────────────
  let adminKpis: {
    trustBalanceCents: number
    debtorsCents: number
    unsentCents: number
    ficaIssues: number
  } | null = null

  if (isAdmin) {
    const [trustIn, trustOut, debtors, unsentAll, ficaIssues] = await Promise.all([
      prisma.trustEntry.aggregate({
        where: { entryType: { in: ['trust_receipt', 'trust_transfer_in', 'collection_receipt'] } },
        _sum: { amountCents: true },
      }),
      prisma.trustEntry.aggregate({
        where: { entryType: { in: ['trust_payment', 'trust_transfer_out'] } },
        _sum: { amountCents: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'sent_invoice' },
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'draft_invoice' },
        _sum: { totalCents: true },
      }),
      prisma.client.count({
        where: { isActive: true, ficaStatus: { not: 'compliant' } },
      }),
    ])
    adminKpis = {
      trustBalanceCents: (trustIn._sum.amountCents ?? 0) - (trustOut._sum.amountCents ?? 0),
      debtorsCents: debtors._sum.totalCents ?? 0,
      unsentCents: unsentAll._sum.totalCents ?? 0,
      ficaIssues,
    }
  }

  // ─── Today display date ───────────────────────────────────────────────────────
  const todayDisplayDate = new Date(todayStr + 'T12:00:00Z').toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  // ─── Serialise diary dates ────────────────────────────────────────────────────
  const serializeDiary = <T extends { dueDate: Date }>(entries: T[]) =>
    entries.map((e) => ({ ...e, dueDate: new Date(e.dueDate).toISOString().slice(0, 10) }))

  log.info('Dashboard data loaded:', {
    wipCount: wip.length,
    wipTotal,
    todayDiaryCount: todayDiary.length,
    weekDiaryCount: weekDiary.length,
    unsentInvoicesCount: unsentInvoices.length,
    isAdmin,
    adminKpisPresent: !!adminKpis,
  })

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #F1EDEA 0%, #E8E0DC 40%, #DDD5CE 70%, #F1EDEA 100%)',
        margin: '-32px',
        padding: '32px',
        minHeight: 'calc(100vh)',
      }}
    >
      <div style={{ paddingBottom: 64 }}>
        <DashboardShell
          data={{
            userId,
            isAdmin,
            firstName,
            todayDisplayDate,
            todayStr,
            wip,
            wipTotal,
            todayDiaryItems: serializeDiary(todayDiary),
            weekDiaryItems: serializeDiary(weekDiary),
            calendarItems: serializeDiary(calendarDiary),
            unsentInvoices: unsentInvoices.map((inv) => ({
              ...inv,
              createdAt: inv.createdAt.toISOString(),
            })),
            adminKpis,
          }}
        />
      </div>
    </div>
  )
}
