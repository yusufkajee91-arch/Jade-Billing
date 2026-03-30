import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateClientSchema = z.object({
  clientName: z.string().min(1).optional(),
  entityType: z
    .enum([
      'individual_sa',
      'company_pty',
      'company_ltd',
      'close_corporation',
      'trust',
      'partnership',
      'foreign_company',
      'other',
    ])
    .optional(),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  let client
  try {
    client = await prisma.client.findUnique({
      where: { id },
      include: {
        ficaDocuments: {
          orderBy: { uploadedAt: 'desc' },
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, initials: true },
            },
          },
        },
        matters: {
          orderBy: { dateOpened: 'desc' },
          select: {
            id: true,
            matterCode: true,
            description: true,
            status: true,
            dateOpened: true,
            owner: {
              select: { id: true, firstName: true, lastName: true, initials: true },
            },
          },
        },
      },
    })
  } catch (err) {
    console.error('[GET /api/clients/[id]]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(client)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Admin can edit any; fee_earner can only edit clients they created
  if (
    session.user.role !== 'admin' &&
    existing.createdById !== session.user.id
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(client)
}
