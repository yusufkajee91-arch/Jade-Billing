import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateMatterSchema = z.object({
  description: z.string().min(1).optional(),
  matterTypeId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  status: z.enum(['open', 'closed', 'suspended']).optional(),
  dateClosed: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  userIds: z.array(z.string()).optional(),
  // Practice Notes fields
  matterStatusNote: z.string().optional().nullable(),
  toDo: z.unknown().optional().nullable(),
  allocation: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  billingStatus: z.enum(['not_yet_billed', 'awaiting_payment', 'paid']).optional(),
  loeFicaDone: z.boolean().optional(),
})

const userSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  initials: true,
  role: true,
}

async function checkAccess(
  matterId: string,
  userId: string,
  role: string,
) {
  if (role === 'admin') return true
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      ownerId: true,
      matterUsers: { select: { userId: true } },
    },
  })
  if (!matter) return null
  if (matter.ownerId === userId) return true
  return matter.matterUsers.some((mu) => mu.userId === userId)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  const access = await checkAccess(id, session.user.id, session.user.role)
  if (access === null) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: true,
      owner: { select: userSelectFields },
      matterType: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      matterUsers: {
        include: {
          user: { select: userSelectFields },
          grantedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      attachments: {
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      },
      matterNotes: {
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      diaryEntries: {
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  })

  if (!matter) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }

  return NextResponse.json(matter)
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

  const matter = await prisma.matter.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true },
  })
  if (!matter) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }

  // Only admin or owner can edit
  if (session.user.role !== 'admin' && matter.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateMatterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { userIds, dateClosed, status, ...rest } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { ...rest }

  if (status) {
    updateData.status = status
    if (status === 'closed') {
      updateData.dateClosed = dateClosed ? new Date(dateClosed) : new Date()
    }
  }

  if (dateClosed !== undefined && status !== 'closed') {
    updateData.dateClosed = dateClosed ? new Date(dateClosed) : null
  }

  const updated = await prisma.matter.update({
    where: { id },
    data: updateData,
    include: {
      client: {
        select: { id: true, clientCode: true, clientName: true, ficaStatus: true },
      },
      owner: { select: userSelectFields },
      matterType: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  // Replace matterUsers if provided
  if (userIds !== undefined) {
    await prisma.matterUser.deleteMany({ where: { matterId: id } })
    const allUserIds = new Set([updated.ownerId, ...userIds])
    if (allUserIds.size > 0) {
      await prisma.matterUser.createMany({
        data: Array.from(allUserIds).map((uid) => ({
          matterId: id,
          userId: uid,
          grantedById: session.user.id,
        })),
        skipDuplicates: true,
      })
    }
  }

  return NextResponse.json(updated)
}
