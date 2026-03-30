import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const clientSchema = z.object({
  clientCode: z
    .string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be 10 characters or fewer')
    .regex(/^[A-Z0-9-]+$/i, 'Client code may only contain letters, numbers, and hyphens')
    .transform((v) => v.toUpperCase()),
  clientName: z.string().min(1),
  entityType: z.enum([
    'individual_sa',
    'company_pty',
    'company_ltd',
    'close_corporation',
    'trust',
    'partnership',
    'foreign_company',
    'other',
  ]),
  emailGeneral: z.string().email().or(z.literal('')).optional().nullable(),
  emailInvoices: z.string().email().or(z.literal('')).optional().nullable(),
  emailStatements: z.string().email().or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  physicalAddressLine1: z.string().optional().nullable(),
  physicalAddressLine2: z.string().optional().nullable(),
  physicalCity: z.string().optional().nullable(),
  physicalProvince: z.string().optional().nullable(),
  physicalPostalCode: z.string().optional().nullable(),
  postalAddressLine1: z.string().optional().nullable(),
  postalAddressLine2: z.string().optional().nullable(),
  postalCity: z.string().optional().nullable(),
  postalProvince: z.string().optional().nullable(),
  postalPostalCode: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  ficaStatus: z
    .enum(['not_compliant', 'partially_compliant', 'compliant'])
    .optional(),
  ficaNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

const clientSelectFields = {
  id: true,
  clientCode: true,
  clientName: true,
  entityType: true,
  ficaStatus: true,
  isActive: true,
  createdAt: true,
  emailGeneral: true,
  emailInvoices: true,
  tel: true,
  mobile: true,
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const activeParam = searchParams.get('active')

  const where: Record<string, unknown> = {}
  if (activeParam === 'true') where.isActive = true
  if (activeParam === 'false') where.isActive = false
  if (q) {
    where.OR = [
      { clientCode: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
    ]
  }

  try {
    const clients = await prisma.client.findMany({
      where,
      select: {
        ...clientSelectFields,
        _count: {
          select: { matters: { where: { status: 'open' } } },
        },
      },
      orderBy: { clientCode: 'asc' },
    })
    return NextResponse.json(clients)
  } catch (err) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = clientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Check unique clientCode
  const existing = await prisma.client.findUnique({
    where: { clientCode: parsed.data.clientCode },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A client with this code already exists' },
      { status: 409 },
    )
  }

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      ficaStatus: parsed.data.ficaStatus ?? 'not_compliant',
      isActive: parsed.data.isActive ?? true,
      createdById: session.user.id,
    },
    select: {
      ...clientSelectFields,
      _count: {
        select: { matters: { where: { status: 'open' } } },
      },
    },
  })

  return NextResponse.json(client, { status: 201 })
}
