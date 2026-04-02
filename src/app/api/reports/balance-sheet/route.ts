import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/balance-sheet')

// GET /api/reports/balance-sheet?asAt=
// Returns assets, liabilities, and equity (retained earnings = cumulative net income).
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
    const asAtParam = searchParams.get('asAt')
    const asAt = asAtParam ? new Date(asAtParam) : undefined
    log.debug('Query params:', { asAt: asAtParam })

    const accounts = await prisma.glAccount.findMany({
      where: { accountType: { in: ['asset', 'liability', 'income', 'expense'] }, isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              ...(asAt ? { entryDate: { lte: asAt } } : {}),
            },
          },
          select: { debitCents: true, creditCents: true },
        },
      },
      orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
    })
    log.debug('GL accounts fetched:', { count: accounts.length })

    const assets: { code: string; name: string; balanceCents: number }[] = []
    const liabilities: { code: string; name: string; balanceCents: number }[] = []
    let retainedEarningsCents = 0

    for (const account of accounts) {
      const totalDebits = account.journalLines.reduce((s, l) => s + l.debitCents, 0)
      const totalCredits = account.journalLines.reduce((s, l) => s + l.creditCents, 0)

      if (account.accountType === 'asset') {
        // Assets: normal debit balance
        assets.push({ code: account.code, name: account.name, balanceCents: totalDebits - totalCredits })
      } else if (account.accountType === 'liability') {
        // Liabilities: normal credit balance
        liabilities.push({ code: account.code, name: account.name, balanceCents: totalCredits - totalDebits })
      } else if (account.accountType === 'income') {
        // Income contributes to retained earnings (credit balance)
        retainedEarningsCents += totalCredits - totalDebits
      } else if (account.accountType === 'expense') {
        // Expenses reduce retained earnings (debit balance)
        retainedEarningsCents -= totalDebits - totalCredits
      }
    }

    const totalAssetsCents = assets.reduce((s, a) => s + a.balanceCents, 0)
    const totalLiabilitiesCents = liabilities.reduce((s, a) => s + a.balanceCents, 0)
    const totalEquityCents = retainedEarningsCents
    const balanceCheck = totalAssetsCents - totalLiabilitiesCents - totalEquityCents

    log.info('GET completed successfully', { assetCount: assets.length, liabilityCount: liabilities.length, balanceCheck })
    return NextResponse.json({
      assets,
      liabilities,
      equity: [{ code: 'RE', name: 'Retained Earnings', balanceCents: retainedEarningsCents }],
      totalAssetsCents,
      totalLiabilitiesCents,
      totalEquityCents,
      balanceCheck, // should be 0 if balanced
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
