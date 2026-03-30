import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const trustEntrySchema = z.object({
  matterId: z.string().uuid(),
  entryType: z.enum([
    'trust_receipt',
    'trust_payment',
    'trust_transfer_in',
    'trust_transfer_out',
    'collection_receipt',
  ]),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  narration: z.string().min(1),
  referenceNumber: z.string().optional().nullable(),
  chequeNumber: z.string().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const matterId = searchParams.get('matterId')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : undefined

  const entries = await prisma.trustEntry.findMany({
    where: matterId ? { matterId } : {},
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    ...(limit ? { take: limit } : {}),
  })

  // For matter-specific queries return chronological order for running balance
  if (matterId) {
    entries.sort((a, b) => {
      const d = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
      if (d !== 0) return d
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = trustEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const entry = await prisma.trustEntry.create({
      data: {
        ...parsed.data,
        entryDate: new Date(parsed.data.entryDate),
        createdById: session.user.id,
      },
      include: { supplier: { select: { id: true, name: true } } },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Insufficient trust funds')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    throw err
  }
}
