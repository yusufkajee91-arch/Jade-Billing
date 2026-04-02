import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/gl-detail')

// GET /api/reports/gl-detail?accountId=&from=&to=
// Returns per-account journal entries with opening/running/closing balances.
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
    const accountId = searchParams.get('accountId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    log.debug('Query params:', { accountId, from: fromParam, to: toParam })

    if (!accountId) {
      log.warn('Missing required param: accountId')
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const account = await prisma.glAccount.findUnique({ where: { id: accountId } })
    if (!account) {
      log.warn('Account not found', { accountId })
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const dateFrom = fromParam ? new Date(fromParam) : undefined
    const dateTo = toParam ? new Date(toParam) : undefined

    // Opening balance: all lines for this account before dateFrom
    let openingDebitCents = 0
    let openingCreditCents = 0
    if (dateFrom) {
      const openingLines = await prisma.journalLine.findMany({
        where: { accountId, journalEntry: { entryDate: { lt: dateFrom } } },
        select: { debitCents: true, creditCents: true },
      })
      for (const line of openingLines) {
        openingDebitCents += line.debitCents
        openingCreditCents += line.creditCents
      }
      log.debug('Opening balance lines:', { count: openingLines.length, openingDebitCents, openingCreditCents })
    }

    // Normal balance sign: asset/expense = debit; income/liability/equity = credit
    const isDebitNormal = ['asset', 'expense'].includes(account.accountType)
    const openingBalanceCents = isDebitNormal
      ? openingDebitCents - openingCreditCents
      : openingCreditCents - openingDebitCents

    // In-period lines
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          ...(dateFrom || dateTo
            ? { entryDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
            : {}),
        },
      },
      include: {
        journalEntry: {
          select: { id: true, entryDate: true, narration: true, referenceNumber: true },
        },
        matter: { select: { matterCode: true } },
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    })
    log.debug('In-period journal lines fetched:', { count: lines.length })

    let runningBalance = openingBalanceCents
    const entries = lines.map((line) => {
      const movement = isDebitNormal
        ? line.debitCents - line.creditCents
        : line.creditCents - line.debitCents
      runningBalance += movement
      return {
        id: line.id,
        date: line.journalEntry.entryDate.toISOString().slice(0, 10),
        narration: line.journalEntry.narration,
        referenceNumber: line.journalEntry.referenceNumber,
        matterCode: line.matter?.matterCode ?? null,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
        balanceCents: runningBalance,
      }
    })

    // Fetch all GL accounts for filter dropdown (so UI can populate)
    const allAccounts = await prisma.glAccount.findMany({
      where: { isActive: true },
      orderBy: [{ code: 'asc' }],
      select: { id: true, code: true, name: true, accountType: true },
    })

    log.info('GET completed successfully', { accountCode: account.code, entryCount: entries.length, openingBalanceCents, closingBalanceCents: runningBalance })
    return NextResponse.json({
      account: { id: account.id, code: account.code, name: account.name, accountType: account.accountType },
      openingBalanceCents,
      closingBalanceCents: runningBalance,
      entries,
      allAccounts,
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
