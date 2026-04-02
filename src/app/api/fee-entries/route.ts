import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { roundToBillingBlock, calcTimeAmount, calcDiscount } from '@/lib/billing-blocks'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-entries')

const createFeeEntrySchema = z.object({
  matterId: z.string().min(1),
  entryType: z.enum(['time', 'unitary', 'disbursement']),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  narration: z.string().min(1, 'Narration is required'),

  // Time entries
  durationMinutesRaw: z.number().int().min(0).optional().nullable(),

  // Unitary (integer thousandths, e.g. 2500 = 2.500 units)
  unitQuantityThousandths: z.number().int().min(0).optional().nullable(),

  // Rate (cents per hour for time; cents per unit for unitary; total cost for disbursement)
  rateCents: z.number().int().min(0),

  // Discount as integer percentage 0–100
  discountPct: z.number().int().min(0).max(100).default(0),

  isBillable: z.boolean().default(true),
  postingCodeId: z.string().optional().nullable(),
  feeEarnerId: z.string().min(1),

  // Whether to also create a matter note with the narration
  addToNotes: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const earnerId = searchParams.get('earnerId') ?? session.user.id
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    log.debug('GET params:', { earnerId, from, to, userId: session.user.id, role: session.user.role })

    // Admin can view any earner; fee_earner can only view own
    if (earnerId !== session.user.id && session.user.role !== 'admin') {
      log.warn('GET forbidden - non-admin trying to view other earner entries', { earnerId, userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where: Record<string, unknown> = { feeEarnerId: earnerId }
    if (from || to) {
      const dateFilter: Record<string, unknown> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      where.entryDate = dateFilter
    }

    const entries = await prisma.feeEntry.findMany({
      where,
      select: {
        id: true,
        matterId: true,
        entryType: true,
        entryDate: true,
        narration: true,
        durationMinutesRaw: true,
        durationMinutesBilled: true,
        unitQuantityThousandths: true,
        rateCents: true,
        amountCents: true,
        discountPct: true,
        discountCents: true,
        totalCents: true,
        isBillable: true,
        isInvoiced: true,
        feeEarner: { select: { id: true, firstName: true, lastName: true, initials: true } },
        matter: { select: { id: true, matterCode: true, description: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    })

    log.info(`GET completed, returning ${entries.length} fee entries`)
    return NextResponse.json(entries)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role === 'assistant') {
      log.warn('POST forbidden - assistant role', { userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('POST body:', { entryType: body.entryType, matterId: body.matterId, feeEarnerId: body.feeEarnerId })
    const parsed = createFeeEntrySchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const d = parsed.data

    // Verify matter exists
    const matter = await prisma.matter.findUnique({ where: { id: d.matterId }, select: { id: true } })
    if (!matter) {
      log.warn('POST matter not found:', { matterId: d.matterId })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }

    // Get firm settings for billing block rounding
    const firm = await prisma.firmSettings.findFirst({
      select: { billingBlocksEnabled: true },
    })
    const billingBlocksEnabled = firm?.billingBlocksEnabled ?? true
    log.debug('POST billing blocks enabled:', billingBlocksEnabled)

    // Calculate billed minutes (with optional rounding)
    let durationMinutesBilled: number | null = null
    let amountCents = 0

    if (d.entryType === 'time') {
      const rawMins = d.durationMinutesRaw ?? 0
      durationMinutesBilled = billingBlocksEnabled ? roundToBillingBlock(rawMins) : rawMins
      amountCents = calcTimeAmount(durationMinutesBilled, d.rateCents)
    } else if (d.entryType === 'unitary') {
      const qty = (d.unitQuantityThousandths ?? 0) / 1000
      amountCents = Math.round(qty * d.rateCents)
    } else {
      // disbursement: rateCents IS the amount
      amountCents = d.rateCents
    }

    const discountCents = calcDiscount(amountCents, d.discountPct)
    const totalCents = amountCents - discountCents
    log.debug('POST calculated amounts:', { amountCents, discountCents, totalCents, durationMinutesBilled })

    const entry = await prisma.feeEntry.create({
      data: {
        matterId: d.matterId,
        entryType: d.entryType,
        entryDate: new Date(d.entryDate),
        narration: d.narration,
        durationMinutesRaw: d.entryType === 'time' ? (d.durationMinutesRaw ?? 0) : null,
        durationMinutesBilled: d.entryType === 'time' ? durationMinutesBilled : null,
        unitQuantityThousandths:
          d.entryType === 'unitary' ? (d.unitQuantityThousandths ?? 0) : null,
        rateCents: d.rateCents,
        amountCents,
        discountPct: d.discountPct,
        discountCents,
        totalCents,
        isBillable: d.isBillable,
        postingCodeId: d.postingCodeId ?? null,
        feeEarnerId: d.feeEarnerId,
        createdById: session.user.id,
      },
    })

    // Optionally create a matter note with the narration
    if (d.addToNotes) {
      log.debug('POST creating matter note from fee entry:', { matterId: d.matterId, entryId: entry.id })
      await prisma.matterNote.create({
        data: {
          matterId: d.matterId,
          content: d.narration,
          source: 'from_fee_entry',
          feeEntryId: entry.id,
          createdById: session.user.id,
        },
      })
    }

    log.info('POST completed, created fee entry:', { id: entry.id, entryType: d.entryType, totalCents })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
