import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/gl/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns each GL account with total debits, total credits, and net balance.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

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

  return NextResponse.json({ rows, grandTotalDebitCents: grandTotalDebit, grandTotalCreditCents: grandTotalCredit })
}
