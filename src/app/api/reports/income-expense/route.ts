import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/income-expense')

// GET /api/reports/income-expense?from=&to=
// Returns income vs expense GL account aggregates (P&L report).
// Income accounts: 4xxx, Expense accounts: 5xxx
export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('Unauthorized request — no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('Forbidden — user role is not admin', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    log.debug('Query params:', { from: fromParam, to: toParam })

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
    log.debug('GL accounts fetched:', { count: accounts.length })

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

    log.info('GET completed successfully', { incomeAccounts: income.length, expenseAccounts: expenses.length, netProfitCents })
    return NextResponse.json({ income, expenses, totalIncomeCents, totalExpensesCents, netProfitCents })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
