import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Atomic trust-to-business transfer: debit trust, credit business account.
// This is the ONLY mechanism for moving money between ledgers.
const trustToBusinessSchema = z.object({
  matterId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  narration: z.string().min(1),
  referenceNumber: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = trustToBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { matterId, entryDate, amountCents, narration, referenceNumber } = parsed.data

  try {
    const [trustEntry, businessEntry] = await prisma.$transaction(async (tx) => {
      // Debit trust (trigger checks non-negative balance)
      const te = await tx.trustEntry.create({
        data: {
          matterId,
          entryType: 'trust_transfer_out',
          entryDate: new Date(entryDate),
          amountCents,
          narration,
          referenceNumber,
          createdById: session.user.id,
        },
      })

      const be = await tx.businessEntry.create({
        data: {
          matterId,
          entryType: 'trust_to_business',
          entryDate: new Date(entryDate),
          amountCents,
          narration,
          referenceNumber,
          linkedTrustEntryId: te.id,
          createdById: session.user.id,
        },
      })

      return [te, be]
    })

    return NextResponse.json({ trustEntry, businessEntry }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Insufficient trust funds')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    throw err
  }
}
