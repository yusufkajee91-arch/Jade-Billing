import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const businessEntrySchema = z.object({
  matterId: z.string().uuid().optional().nullable(),
  entryType: z.enum([
    'matter_receipt',
    'matter_payment',
    'business_receipt',
    'business_payment',
    'supplier_invoice',
    'supplier_payment',
    'bank_transfer',
    'trust_to_business',
  ]),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  narration: z.string().min(1),
  referenceNumber: z.string().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const matterId = searchParams.get('matterId')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : undefined

  const entries = await prisma.businessEntry.findMany({
    where: matterId ? { matterId } : {},
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: [{ entryDate: matterId ? 'asc' : 'desc' }, { createdAt: matterId ? 'asc' : 'desc' }],
    ...(limit ? { take: limit } : {}),
  })

  return NextResponse.json(entries)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = businessEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const entry = await prisma.businessEntry.create({
    data: {
      ...parsed.data,
      entryDate: new Date(parsed.data.entryDate),
      createdById: session.user.id,
    },
    include: { supplier: { select: { id: true, name: true } } },
  })

  return NextResponse.json(entry, { status: 201 })
}
