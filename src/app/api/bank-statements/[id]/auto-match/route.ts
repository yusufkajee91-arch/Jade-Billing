import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Trust inflow/outflow types
const TRUST_INFLOW = new Set(['trust_receipt', 'collection_receipt'])
const TRUST_OUTFLOW = new Set(['trust_payment'])

// Business inflow/outflow types
const BUSINESS_INFLOW = new Set(['matter_receipt', 'business_receipt', 'trust_to_business'])
const BUSINESS_OUTFLOW = new Set([
  'matter_payment',
  'business_payment',
  'supplier_payment',
  'bank_transfer',
])

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

// ─── POST /api/bank-statements/[id]/auto-match ────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const statement = await prisma.bankStatement.findUnique({
    where: { id },
    include: {
      lines: {
        where: { isReconciled: false },
        orderBy: [{ transactionDate: 'asc' }, { lineNumber: 'asc' }],
      },
    },
  })

  if (!statement) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isTrust = statement.accountType === 'trust'

  // Determine date range for candidate ledger entries
  const dates = statement.lines.map(l => new Date(l.transactionDate).getTime())
  if (dates.length === 0) {
    return NextResponse.json({ matchesCreated: 0 })
  }
  const minDate = new Date(Math.min(...dates) - THREE_DAYS_MS)
  const maxDate = new Date(Math.max(...dates) + THREE_DAYS_MS)

  let matchesCreated = 0

  if (isTrust) {
    // Fetch all unmatched trust entries in the expanded date window
    const trustEntries = await prisma.trustEntry.findMany({
      where: {
        entryDate: { gte: minDate, lte: maxDate },
        bankMatches: { none: {} },
      },
      select: { id: true, entryType: true, entryDate: true, amountCents: true },
    })

    for (const bankLine of statement.lines) {
      const lineDate = new Date(bankLine.transactionDate).getTime()
      const isInflow = bankLine.amountCents > 0
      const absAmount = Math.abs(bankLine.amountCents)

      // Find best matching trust entry
      let bestEntry: (typeof trustEntries)[number] | null = null
      let bestDiff = Infinity

      for (const entry of trustEntries) {
        if (entry.amountCents !== absAmount) continue
        const entryDate = new Date(entry.entryDate).getTime()
        const dateDiff = Math.abs(lineDate - entryDate)
        if (dateDiff > THREE_DAYS_MS) continue

        const entryTypeSet = isInflow ? TRUST_INFLOW : TRUST_OUTFLOW
        if (!entryTypeSet.has(entry.entryType)) continue

        if (dateDiff < bestDiff) {
          bestDiff = dateDiff
          bestEntry = entry
        }
      }

      if (bestEntry) {
        await prisma.bankMatch.create({
          data: {
            bankStatementLineId: bankLine.id,
            trustEntryId: bestEntry.id,
            matchedById: session.user.id,
          },
        })
        // Remove from candidates to avoid double-matching
        const idx = trustEntries.indexOf(bestEntry)
        trustEntries.splice(idx, 1)
        matchesCreated++
      }
    }
  } else {
    // Business statement
    const businessEntries = await prisma.businessEntry.findMany({
      where: {
        entryDate: { gte: minDate, lte: maxDate },
        bankMatches: { none: {} },
      },
      select: { id: true, entryType: true, entryDate: true, amountCents: true },
    })

    for (const bankLine of statement.lines) {
      const lineDate = new Date(bankLine.transactionDate).getTime()
      const isInflow = bankLine.amountCents > 0
      const absAmount = Math.abs(bankLine.amountCents)

      let bestEntry: (typeof businessEntries)[number] | null = null
      let bestDiff = Infinity

      for (const entry of businessEntries) {
        if (entry.amountCents !== absAmount) continue
        const entryDate = new Date(entry.entryDate).getTime()
        const dateDiff = Math.abs(lineDate - entryDate)
        if (dateDiff > THREE_DAYS_MS) continue

        const entryTypeSet = isInflow ? BUSINESS_INFLOW : BUSINESS_OUTFLOW
        if (!entryTypeSet.has(entry.entryType)) continue

        if (dateDiff < bestDiff) {
          bestDiff = dateDiff
          bestEntry = entry
        }
      }

      if (bestEntry) {
        await prisma.bankMatch.create({
          data: {
            bankStatementLineId: bankLine.id,
            businessEntryId: bestEntry.id,
            matchedById: session.user.id,
          },
        })
        const idx = businessEntries.indexOf(bestEntry)
        businessEntries.splice(idx, 1)
        matchesCreated++
      }
    }
  }

  return NextResponse.json({ matchesCreated })
}
