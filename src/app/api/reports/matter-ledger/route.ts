import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/reports/matter-ledger?matterId=&from=&to=
// Returns trust entries for a matter with opening balance and running balance.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const matterId = searchParams.get('matterId')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (!matterId) {
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
  if (!matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })

  // Check access
  if (session.user.role !== 'admin') {
    const access = await prisma.matterUser.findFirst({
      where: { matterId, userId: session.user.id },
    })
    const isOwner = await prisma.matter.findFirst({ where: { id: matterId, ownerId: session.user.id } })
    if (!access && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  return NextResponse.json({
    matter,
    openingBalanceCents,
    closingBalanceCents: runningBalance,
    entries: rows,
  })
}
