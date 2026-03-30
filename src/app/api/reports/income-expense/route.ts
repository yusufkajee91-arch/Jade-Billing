import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/reports/income-expense?from=&to=
// Returns income vs expense GL account aggregates (P&L report).
// Income accounts: 4xxx, Expense accounts: 5xxx
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  const accounts = await prisma.glAccount.findMany({
    where: { accountType: { in: ['income', 'expense'] }, isActive: true },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            ...(dateFrom || dateTo
              ? { entryDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
              : {}),
          },
        },
        select: { debitCents: true, creditCents: true },
      },
    },
    orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
  })

  const income: { code: string; name: string; balanceCents: number }[] = []
  const expenses: { code: string; name: string; balanceCents: number }[] = []

  for (const account of accounts) {
    const totalDebits = account.journalLines.reduce((s, l) => s + l.debitCents, 0)
    const totalCredits = account.journalLines.reduce((s, l) => s + l.creditCents, 0)

    if (account.accountType === 'income') {
      // Income: normal credit balance — credits increase, debits decrease
      const balanceCents = totalCredits - totalDebits
      income.push({ code: account.code, name: account.name, balanceCents })
    } else {
      // Expense: normal debit balance — debits increase, credits decrease
      const balanceCents = totalDebits - totalCredits
      expenses.push({ code: account.code, name: account.name, balanceCents })
    }
  }

  const totalIncomeCents = income.reduce((s, a) => s + a.balanceCents, 0)
  const totalExpensesCents = expenses.reduce((s, a) => s + a.balanceCents, 0)
  const netProfitCents = totalIncomeCents - totalExpensesCents

  return NextResponse.json({ income, expenses, totalIncomeCents, totalExpensesCents, netProfitCents })
}
