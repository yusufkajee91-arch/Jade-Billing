import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('clients/[id]')

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
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('GET client id:', id)

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
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }

  if (!client) {
    log.warn('GET client not found', { id })
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  log.info('GET completed successfully', { clientCode: client.clientCode })
  return NextResponse.json(client)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('PATCH unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('PATCH client id:', id)

  try {
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      log.warn('PATCH client not found', { id })
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Admin can edit any; fee_earner can only edit clients they created
    if (
      session.user.role !== 'admin' &&
      existing.createdById !== session.user.id
    ) {
      log.warn('PATCH forbidden', { role: session.user.role, userId: session.user.id, createdById: existing.createdById })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('PATCH body:', body)
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('PATCH validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const client = await prisma.client.update({
      where: { id },
      data: parsed.data,
    })

    log.info('PATCH completed successfully', { clientId: client.id })
    return NextResponse.json(client)
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
