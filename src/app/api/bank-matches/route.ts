import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createMatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { bankStatementLineId, trustEntryId, businessEntryId, notes } = parsed.data

  // Validate bank statement line exists and is not already reconciled
  const bankLine = await prisma.bankStatementLine.findUnique({
    where: { id: bankStatementLineId },
  })
  if (!bankLine) {
    return NextResponse.json({ error: 'Bank statement line not found' }, { status: 404 })
  }
  if (bankLine.isReconciled) {
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

  return NextResponse.json(match, { status: 201 })
}
