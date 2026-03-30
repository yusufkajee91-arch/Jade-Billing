import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { roundToBillingBlock, calcTimeAmount, calcDiscount } from '@/lib/billing-blocks'

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
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const earnerId = searchParams.get('earnerId') ?? session.user.id
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Admin can view any earner; fee_earner can only view own
  if (earnerId !== session.user.id && session.user.role !== 'admin') {
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

  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role === 'assistant') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createFeeEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const d = parsed.data

  // Verify matter exists
  const matter = await prisma.matter.findUnique({ where: { id: d.matterId }, select: { id: true } })
  if (!matter) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }

  // Get firm settings for billing block rounding
  const firm = await prisma.firmSettings.findFirst({
    select: { billingBlocksEnabled: true },
  })
  const billingBlocksEnabled = firm?.billingBlocksEnabled ?? true

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

  return NextResponse.json(entry, { status: 201 })
}
