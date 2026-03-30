import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMatterCode } from '@/lib/matter-code'
import { z } from 'zod'

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
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  const isAdmin = session.user.role === 'admin'
  const userId = session.user.id

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

  return NextResponse.json(matters)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createMatterSchema.safeParse(body)
  if (!parsed.success) {
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
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerId } })
  if (!owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  let matterCode = manualCode
  if (!matterCode) {
    matterCode = await generateMatterCode(owner.initials, client.clientCode)
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

  return NextResponse.json(matter, { status: 201 })
}
