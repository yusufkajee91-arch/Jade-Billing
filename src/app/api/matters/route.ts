import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMatterCode } from '@/lib/matter-code'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters')

const createMatterSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  description: z.string().min(1, 'Description is required'),
  ownerId: z.string().min(1, 'Owner is required'),
  matterTypeId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  userIds: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  matterCode: z.string().optional().nullable(),
})

const userSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  initials: true,
  role: true,
}

export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const q = searchParams.get('q')

    const isAdmin = session.user.role === 'admin'
    const userId = session.user.id
    log.debug('GET params:', { clientId, status, q, isAdmin, userId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (!isAdmin) {
      where.OR = [
        { ownerId: userId },
        { matterUsers: { some: { userId } } },
      ]
    }

    const code = searchParams.get('code')

    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (code) where.matterCode = { equals: code, mode: 'insensitive' as const }

    if (q) {
      const qFilter = [
        { matterCode: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { client: { clientName: { contains: q, mode: 'insensitive' as const } } },
        { client: { clientCode: { contains: q, mode: 'insensitive' as const } } },
      ]
      if (where.OR) {
        // Already has access control OR — wrap both in AND
        where.AND = [{ OR: where.OR }, { OR: qFilter }]
        delete where.OR
      } else {
        where.OR = qFilter
      }
    }

    const matters = await prisma.matter.findMany({
      where,
      include: {
        client: {
          select: { id: true, clientCode: true, clientName: true, ficaStatus: true },
        },
        owner: { select: userSelectFields },
        matterType: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    log.info(`GET completed, returning ${matters.length} matters`)
    return NextResponse.json(matters)
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
    if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
      log.warn('POST forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('POST body:', { clientId: body.clientId, description: body.description, ownerId: body.ownerId })
    const parsed = createMatterSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { clientId, description, ownerId, matterTypeId, departmentId, userIds, notes, matterCode: manualCode } =
      parsed.data

    // Fetch client and owner for code generation
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      log.warn('POST client not found:', { clientId })
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId } })
    if (!owner) {
      log.warn('POST owner not found:', { ownerId })
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    let matterCode = manualCode
    if (!matterCode) {
      matterCode = await generateMatterCode(owner.initials, client.clientCode)
      log.debug('POST generated matter code:', { matterCode })
    } else {
      log.debug('POST using manual matter code:', { matterCode })
    }

    const matter = await prisma.matter.create({
      data: {
        matterCode,
        clientId,
        description,
        matterTypeId: matterTypeId ?? null,
        departmentId: departmentId ?? null,
        ownerId,
        notes: notes ?? null,
        createdById: session.user.id,
      },
      include: {
        client: {
          select: { id: true, clientCode: true, clientName: true, ficaStatus: true },
        },
        owner: { select: userSelectFields },
        matterType: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    })

    // Create MatterUser for owner (always)
    const allUserIds = new Set([ownerId, ...(userIds ?? [])])
    await prisma.matterUser.createMany({
      data: Array.from(allUserIds).map((uid) => ({
        matterId: matter.id,
        userId: uid,
        grantedById: session.user.id,
      })),
      skipDuplicates: true,
    })

    log.info('POST completed, created matter:', { id: matter.id, matterCode, userCount: allUserIds.size })
    return NextResponse.json(matter, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
