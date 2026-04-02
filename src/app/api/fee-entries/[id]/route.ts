import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { roundToBillingBlock, calcTimeAmount, calcDiscount } from '@/lib/billing-blocks'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-entries/[id]')

const updateFeeEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  narration: z.string().min(1).optional(),
  durationMinutesRaw: z.number().int().min(0).optional().nullable(),
  unitQuantityThousandths: z.number().int().min(0).optional().nullable(),
  rateCents: z.number().int().min(0).optional(),
  discountPct: z.number().int().min(0).max(100).optional(),
  isBillable: z.boolean().optional(),
  postingCodeId: z.string().optional().nullable(),
  feeEarnerId: z.string().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('GET fee entry by id:', { id })
    const entry = await prisma.feeEntry.findUnique({
      where: { id },
      include: {
        feeEarner: { select: { id: true, firstName: true, lastName: true, initials: true } },
        postingCode: { select: { id: true, code: true, description: true } },
        matter: { select: { id: true, matterCode: true, description: true } },
      },
    })
    if (!entry) {
      log.warn('GET fee entry not found:', { id })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    log.info('GET completed, returning fee entry:', { id, entryType: entry.entryType })
    return NextResponse.json(entry)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('PATCH unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('PATCH fee entry:', { id })
    const existing = await prisma.feeEntry.findUnique({ where: { id } })
    if (!existing) {
      log.warn('PATCH fee entry not found:', { id })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.isInvoiced) {
      log.warn('PATCH rejected - entry already invoiced:', { id })
      return NextResponse.json({ error: 'Invoiced entries cannot be edited' }, { status: 409 })
    }

    // Only admin or the fee earner who created it can edit
    if (session.user.role !== 'admin' && existing.feeEarnerId !== session.user.id) {
      log.warn('PATCH forbidden - not owner or admin:', { id, userId: session.user.id, feeEarnerId: existing.feeEarnerId })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('PATCH body:', body)
    const parsed = updateFeeEntrySchema.safeParse(body)
    if (!parsed.success) {
      log.warn('PATCH validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const d = parsed.data
    const entryType = existing.entryType

    // Recalculate financials if any financial fields changed
    const firm = await prisma.firmSettings.findFirst({
      select: { billingBlocksEnabled: true },
    })
    const billingBlocksEnabled = firm?.billingBlocksEnabled ?? true

    const newRawMins =
      d.durationMinutesRaw !== undefined ? d.durationMinutesRaw : existing.durationMinutesRaw
    const newUnitQty =
      d.unitQuantityThousandths !== undefined
        ? d.unitQuantityThousandths
        : existing.unitQuantityThousandths
    const newRate = d.rateCents !== undefined ? d.rateCents : existing.rateCents
    const newDiscountPct = d.discountPct !== undefined ? d.discountPct : existing.discountPct

    let newAmountCents = existing.amountCents
    let newBilledMins = existing.durationMinutesBilled

    if (entryType === 'time') {
      const rawMins = newRawMins ?? 0
      newBilledMins = billingBlocksEnabled ? roundToBillingBlock(rawMins) : rawMins
      newAmountCents = calcTimeAmount(newBilledMins, newRate)
    } else if (entryType === 'unitary') {
      const qty = (newUnitQty ?? 0) / 1000
      newAmountCents = Math.round(qty * newRate)
    } else {
      newAmountCents = newRate
    }

    const newDiscountCents = calcDiscount(newAmountCents, newDiscountPct)
    const newTotalCents = newAmountCents - newDiscountCents
    log.debug('PATCH recalculated amounts:', { newAmountCents, newDiscountCents, newTotalCents })

    const updated = await prisma.feeEntry.update({
      where: { id },
      data: {
        ...(d.entryDate ? { entryDate: new Date(d.entryDate) } : {}),
        ...(d.narration !== undefined ? { narration: d.narration } : {}),
        ...(d.isBillable !== undefined ? { isBillable: d.isBillable } : {}),
        ...(d.postingCodeId !== undefined ? { postingCodeId: d.postingCodeId } : {}),
        ...(d.feeEarnerId !== undefined ? { feeEarnerId: d.feeEarnerId } : {}),
        durationMinutesRaw: entryType === 'time' ? (newRawMins ?? 0) : existing.durationMinutesRaw,
        durationMinutesBilled: entryType === 'time' ? newBilledMins : existing.durationMinutesBilled,
        unitQuantityThousandths:
          entryType === 'unitary' ? (newUnitQty ?? 0) : existing.unitQuantityThousandths,
        rateCents: newRate,
        amountCents: newAmountCents,
        discountPct: newDiscountPct,
        discountCents: newDiscountCents,
        totalCents: newTotalCents,
      },
    })

    log.info('PATCH completed, updated fee entry:', { id, totalCents: newTotalCents })
    return NextResponse.json(updated)
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('DELETE unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('DELETE fee entry:', { id })
    const existing = await prisma.feeEntry.findUnique({ where: { id } })
    if (!existing) {
      log.warn('DELETE fee entry not found:', { id })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.isInvoiced) {
      log.warn('DELETE rejected - entry already invoiced:', { id })
      return NextResponse.json({ error: 'Invoiced entries cannot be deleted' }, { status: 409 })
    }

    if (session.user.role !== 'admin' && existing.feeEarnerId !== session.user.id) {
      log.warn('DELETE forbidden - not owner or admin:', { id, userId: session.user.id, feeEarnerId: existing.feeEarnerId })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.feeEntry.delete({ where: { id } })
    log.info('DELETE completed, deleted fee entry:', { id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
