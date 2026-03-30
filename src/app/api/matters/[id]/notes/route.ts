import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
})

async function checkAccess(matterId: string, userId: string, role: string) {
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

  const notes = await prisma.matterNote.findMany({
    where: { matterId: id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(notes)
}

export async function POST(
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

  const body = await request.json()
  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const note = await prisma.matterNote.create({
    data: {
      matterId: id,
      content: parsed.data.content,
      source: 'manual',
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return NextResponse.json(note, { status: 201 })
}
