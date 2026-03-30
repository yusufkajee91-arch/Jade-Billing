import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/gl/journal?from=YYYY-MM-DD&to=YYYY-MM-DD&accountCode=1001&page=0&limit=50
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountCode = searchParams.get('accountCode')
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

  const entryDateFilter =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }
      : undefined

  const accountFilter = accountCode
    ? { lines: { some: { account: { code: accountCode } } } }
    : {}

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where: {
        ...(entryDateFilter ? { entryDate: entryDateFilter } : {}),
        ...accountFilter,
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            matter: { select: { id: true, matterCode: true } },
          },
          orderBy: { debitCents: 'desc' },
        },
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      skip: page * limit,
      take: limit,
    }),
    prisma.journalEntry.count({
      where: {
        ...(entryDateFilter ? { entryDate: entryDateFilter } : {}),
        ...accountFilter,
      },
    }),
  ])

  return NextResponse.json({ entries, total, page, limit })
}
