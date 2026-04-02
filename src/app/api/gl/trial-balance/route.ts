import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('gl/trial-balance')

// GET /api/gl/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns each GL account with total debits, total credits, and net balance.
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
  log.debug('Query params:', { from, to })

  const dateFilter =
    from || to
      ? {
          journalEntry: {
            entryDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          },
        }
      : {}

  const accounts = await prisma.glAccount.findMany({
    where: { isActive: true },
    orderBy: [{ accountType: 'asc' }, { sortOrder: 'asc' }],
    include: {
      journalLines: {
        where: dateFilter,
        select: { debitCents: true, creditCents: true },
      },
    },
  })

  const rows = accounts.map((acct) => {
    const totalDebit = acct.journalLines.reduce((s, l) => s + l.debitCents, 0)
    const totalCredit = acct.journalLines.reduce((s, l) => s + l.creditCents, 0)
    // Normal balance: assets/expenses → debit; liabilities/equity/income → credit
    const normalDebit = acct.accountType === 'asset' || acct.accountType === 'expense'
    const balance = normalDebit ? totalDebit - totalCredit : totalCredit - totalDebit
    return {
      id: acct.id,
      code: acct.code,
      name: acct.name,
      accountType: acct.accountType,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
      balanceCents: balance,
    }
  })

  const grandTotalDebit = rows.reduce((s, r) => s + r.totalDebitCents, 0)
  const grandTotalCredit = rows.reduce((s, r) => s + r.totalCreditCents, 0)

  log.debug('Trial balance computed:', { accountCount: rows.length, grandTotalDebitCents: grandTotalDebit, grandTotalCreditCents: grandTotalCredit })
  log.info('GET completed successfully')
  return NextResponse.json({ rows, grandTotalDebitCents: grandTotalDebit, grandTotalCreditCents: grandTotalCredit })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
