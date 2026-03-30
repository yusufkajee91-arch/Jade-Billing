import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id: matterId } = await params

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') // 'fees' | 'disbursements' | 'all' | undefined
  const billable = searchParams.get('billable') // 'true' | 'false' | null

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

  return NextResponse.json({ entries, summary })
}
