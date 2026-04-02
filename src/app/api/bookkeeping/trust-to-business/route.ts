import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('bookkeeping/trust-to-business')

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
  log.info('POST request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST rejected: unauthorised')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('POST rejected: forbidden', { role: session.user.role })
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json()
  log.debug('Request body:', body)
  const parsed = trustToBusinessSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('POST rejected: validation failed', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { matterId, entryDate, amountCents, narration, referenceNumber } = parsed.data
  log.debug('Parsed data:', { matterId, entryDate, amountCents })

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

    log.info('POST completed successfully', { trustEntryId: trustEntry.id, businessEntryId: businessEntry.id })
    return NextResponse.json({ trustEntry, businessEntry }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Insufficient trust funds')) {
      log.warn('POST rejected: insufficient trust funds', { matterId, amountCents })
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    log.error('POST failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
