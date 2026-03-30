import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Atomic trust-to-trust transfer between two matters
const transferSchema = z.object({
  fromMatterId: z.string().uuid(),
  toMatterId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  narration: z.string().min(1),
  referenceNumber: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = transferSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { fromMatterId, toMatterId, entryDate, amountCents, narration, referenceNumber } =
    parsed.data

  if (fromMatterId === toMatterId) {
    return NextResponse.json({ error: 'Cannot transfer to the same matter' }, { status: 422 })
  }

  try {
    const [outEntry, inEntry] = await prisma.$transaction(async (tx) => {
      // Create the outflow first (trigger will check balance)
      const out = await tx.trustEntry.create({
        data: {
          matterId: fromMatterId,
          entryType: 'trust_transfer_out',
          entryDate: new Date(entryDate),
          amountCents,
          narration,
          referenceNumber,
          createdById: session.user.id,
        },
      })

      const inE = await tx.trustEntry.create({
        data: {
          matterId: toMatterId,
          entryType: 'trust_transfer_in',
          entryDate: new Date(entryDate),
          amountCents,
          narration,
          referenceNumber,
          linkedEntryId: out.id,
          createdById: session.user.id,
        },
      })

      // Back-link: set linkedEntryId on the out entry
      await tx.trustEntry.update({
        where: { id: out.id },
        data: { linkedEntryId: inE.id },
      })

      return [out, inE]
    })

    return NextResponse.json({ outEntry, inEntry }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Insufficient trust funds')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    throw err
  }
}
