import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TrustEntryType } from '@/generated/prisma'

// ─── GET /api/reconciliation/report?statementId=UUID ─────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statementId = searchParams.get('statementId')
  if (!statementId) {
    return NextResponse.json({ error: 'statementId is required' }, { status: 400 })
  }

  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: {
      lines: {
        orderBy: [{ transactionDate: 'asc' }, { lineNumber: 'asc' }],
        include: {
          matches: {
            include: {
              trustEntry: {
                select: {
                  id: true,
                  entryType: true,
                  entryDate: true,
                  amountCents: true,
                  narration: true,
                },
              },
              businessEntry: {
                select: {
                  id: true,
                  entryType: true,
                  entryDate: true,
                  amountCents: true,
                  narration: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!statement) {
    return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
  }

  // ─── Compute reconciliation figures ──────────────────────────────────────────

  const matchedLines = statement.lines.filter(l => l.isReconciled)
  const unmatchedLines = statement.lines.filter(l => !l.isReconciled)

  // Deposits in transit: unmatched inflow (positive) bank lines
  const depositsInTransit = unmatchedLines
    .filter(l => l.amountCents > 0)
    .reduce((sum, l) => sum + l.amountCents, 0)

  // Outstanding payments: unmatched outflow (negative) bank lines — stored as negative cents
  const outstandingPayments = unmatchedLines
    .filter(l => l.amountCents < 0)
    .reduce((sum, l) => sum + l.amountCents, 0)

  // Adjusted bank balance = closing + deposits_in_transit + outstanding_payments
  // (outstanding_payments is negative, so this effectively subtracts them)
  const adjustedBankBalance =
    statement.closingBalanceCents + depositsInTransit + outstandingPayments

  // ─── Trust control balance (if trust statement) ───────────────────────────

  let trustControlBalanceCents: number | null = null
  let isBalanced: boolean | null = null

  if (statement.accountType === 'trust') {
    // Sum all trust entries to get trust control balance
    // trust receipts / transfer_in / collection_receipt → positive
    // trust payments / transfer_out → negative
    const TRUST_INFLOW_TYPES: TrustEntryType[] = [
      TrustEntryType.trust_receipt,
      TrustEntryType.trust_transfer_in,
      TrustEntryType.collection_receipt,
    ]
    const TRUST_OUTFLOW_TYPES: TrustEntryType[] = [
      TrustEntryType.trust_payment,
      TrustEntryType.trust_transfer_out,
    ]

    const [inflowSum, outflowSum] = await Promise.all([
      prisma.trustEntry.aggregate({
        where: { entryType: { in: TRUST_INFLOW_TYPES } },
        _sum: { amountCents: true },
      }),
      prisma.trustEntry.aggregate({
        where: { entryType: { in: TRUST_OUTFLOW_TYPES } },
        _sum: { amountCents: true },
      }),
    ])

    trustControlBalanceCents =
      (inflowSum._sum.amountCents ?? 0) - (outflowSum._sum.amountCents ?? 0)
    isBalanced = adjustedBankBalance === trustControlBalanceCents
  }

  // ─── Unmatched ledger entries in statement date range ────────────────────

  const dateFrom = statement.statementFrom ?? undefined
  const dateTo = statement.statementTo ?? undefined

  let unmatchedLedgerEntries: unknown[] = []

  if (dateFrom && dateTo) {
    if (statement.accountType === 'trust') {
      unmatchedLedgerEntries = await prisma.trustEntry.findMany({
        where: {
          entryDate: { gte: dateFrom, lte: dateTo },
          bankMatches: { none: {} },
        },
        select: {
          id: true,
          entryType: true,
          entryDate: true,
          amountCents: true,
          narration: true,
          referenceNumber: true,
          matter: { select: { id: true, matterCode: true, description: true } },
        },
        orderBy: { entryDate: 'asc' },
      })
    } else {
      unmatchedLedgerEntries = await prisma.businessEntry.findMany({
        where: {
          entryDate: { gte: dateFrom, lte: dateTo },
          bankMatches: { none: {} },
        },
        select: {
          id: true,
          entryType: true,
          entryDate: true,
          amountCents: true,
          narration: true,
          referenceNumber: true,
          matter: { select: { id: true, matterCode: true, description: true } },
        },
        orderBy: { entryDate: 'asc' },
      })
    }
  }

  return NextResponse.json({
    statement: {
      id: statement.id,
      accountType: statement.accountType,
      fileName: statement.fileName,
      accountNumber: statement.accountNumber,
      accountDescription: statement.accountDescription,
      statementFrom: statement.statementFrom,
      statementTo: statement.statementTo,
      openingBalanceCents: statement.openingBalanceCents,
      closingBalanceCents: statement.closingBalanceCents,
      importedAt: statement.importedAt,
    },
    summary: {
      totalLines: statement.lines.length,
      matchedLines: matchedLines.length,
      unmatchedLines: unmatchedLines.length,
      depositsInTransit,
      outstandingPayments,
      adjustedBankBalance,
      trustControlBalanceCents,
      isBalanced,
    },
    lines: statement.lines,
    unmatchedLedgerEntries,
  })
}
