import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters/[id]')

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
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('GET matter by id:', { id })
    const access = await checkAccess(id, session.user.id, session.user.role)
    if (access === null) {
      log.warn('GET matter not found:', { id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }
    if (!access) {
      log.warn('GET forbidden - no access to matter:', { id, userId: session.user.id })
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
      log.warn('GET matter not found after access check:', { id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }

    log.info('GET completed, returning matter:', { id, matterCode: matter.matterCode, notesCount: matter.matterNotes.length, attachmentsCount: matter.attachments.length })
    return NextResponse.json(matter)
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
    log.debug('PATCH matter:', { id })

    const matter = await prisma.matter.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    })
    if (!matter) {
      log.warn('PATCH matter not found:', { id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }

    // Only admin or owner can edit
    if (session.user.role !== 'admin' && matter.ownerId !== session.user.id) {
      log.warn('PATCH forbidden - not owner or admin:', { id, userId: session.user.id, ownerId: matter.ownerId })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('PATCH body:', body)
    const parsed = updateMatterSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('PATCH validation failed:', parsed.error.flatten())
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
      log.debug('PATCH replacing matter users:', { matterId: id, userIds })
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

    log.info('PATCH completed, updated matter:', { id, status: updated.status })
    return NextResponse.json(updated)
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
