import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'
import { z } from 'zod'

const log = apiLogger('bank-matches')

const createMatchSchema = z
  .object({
    bankStatementLineId: z.string().uuid(),
    trustEntryId: z.string().uuid().optional().nullable(),
    businessEntryId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    d => (d.trustEntryId ? !d.businessEntryId : !!d.businessEntryId),
    {
      message: 'Exactly one of trustEntryId or businessEntryId must be provided',
    },
  )

// ─── POST /api/bank-matches ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
      log.warn('POST rejected: forbidden, role =', session.user.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('POST body:', body)
    const parsed = createMatchSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { bankStatementLineId, trustEntryId, businessEntryId, notes } = parsed.data
    log.debug('POST match data:', { bankStatementLineId, trustEntryId, businessEntryId })

    // Validate bank statement line exists and is not already reconciled
    const bankLine = await prisma.bankStatementLine.findUnique({
      where: { id: bankStatementLineId },
    })
    if (!bankLine) {
      log.warn('POST rejected: bank statement line not found, id =', bankStatementLineId)
      return NextResponse.json({ error: 'Bank statement line not found' }, { status: 404 })
    }
    if (bankLine.isReconciled) {
      log.warn('POST rejected: bank statement line already reconciled, id =', bankStatementLineId)
      return NextResponse.json(
        { error: 'Bank statement line is already reconciled' },
        { status: 409 },
      )
    }

    // Check the ledger entry does not already have a match on another bank line
    if (trustEntryId) {
      const existing = await prisma.bankMatch.findFirst({
        where: { trustEntryId },
      })
      if (existing) {
        log.warn('POST rejected: trust entry already matched, trustEntryId =', trustEntryId)
        return NextResponse.json(
          { error: 'Trust entry is already matched to another bank line' },
          { status: 409 },
        )
      }
    }

    if (businessEntryId) {
      const existing = await prisma.bankMatch.findFirst({
        where: { businessEntryId },
      })
      if (existing) {
        log.warn('POST rejected: business entry already matched, businessEntryId =', businessEntryId)
        return NextResponse.json(
          { error: 'Business entry is already matched to another bank line' },
          { status: 409 },
        )
      }
    }

    const match = await prisma.bankMatch.create({
      data: {
        bankStatementLineId,
        trustEntryId: trustEntryId ?? undefined,
        businessEntryId: businessEntryId ?? undefined,
        notes: notes ?? undefined,
        matchedById: session.user.id,
      },
      include: {
        bankStatementLine: true,
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
        matchedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    log.info('POST completed successfully, created match', match.id)
    return NextResponse.json(match, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
