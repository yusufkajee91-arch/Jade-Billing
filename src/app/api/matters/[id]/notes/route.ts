import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters/[id]/notes')

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
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('GET notes for matter:', { matterId: id })
    const access = await checkAccess(id, session.user.id, session.user.role)
    if (access === null) {
      log.warn('GET matter not found:', { matterId: id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }
    if (!access) {
      log.warn('GET forbidden - no access to matter:', { matterId: id, userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const notes = await prisma.matterNote.findMany({
      where: { matterId: id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    log.info(`GET completed, returning ${notes.length} notes for matter ${id}`)
    return NextResponse.json(notes)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('POST note for matter:', { matterId: id })
    const access = await checkAccess(id, session.user.id, session.user.role)
    if (access === null) {
      log.warn('POST matter not found:', { matterId: id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }
    if (!access) {
      log.warn('POST forbidden - no access to matter:', { matterId: id, userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('POST body:', { contentLength: body.content?.length })
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
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

    log.info('POST completed, created note:', { noteId: note.id, matterId: id })
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
