import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('gl/journal')

// GET /api/gl/journal?from=YYYY-MM-DD&to=YYYY-MM-DD&accountCode=1001&page=0&limit=50
export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET rejected: unauthorised')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountCode = searchParams.get('accountCode')
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  log.debug('Query params:', { from, to, accountCode, page, limit })

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

  log.debug('Journal entries found:', { total, returned: entries.length })
  log.info('GET completed successfully')
  return NextResponse.json({ entries, total, page, limit })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
