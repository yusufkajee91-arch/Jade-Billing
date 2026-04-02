import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters/[id]/attachments')

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
    log.debug('GET attachments for matter:', { matterId: id })
    const access = await checkAccess(id, session.user.id, session.user.role)
    if (access === null) {
      log.warn('GET matter not found:', { matterId: id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }
    if (!access) {
      log.warn('GET forbidden - no access to matter:', { matterId: id, userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachments = await prisma.matterAttachment.findMany({
      where: { matterId: id },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    log.info(`GET completed, returning ${attachments.length} attachments for matter ${id}`)
    return NextResponse.json(
      attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSizeBytes: a.fileSizeBytes,
        mimeType: a.mimeType,
        description: a.description,
        uploadedAt: a.uploadedAt,
        uploadedBy: a.uploadedBy,
      })),
    )
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
    log.debug('POST attachment for matter:', { matterId: id })
    const access = await checkAccess(id, session.user.id, session.user.role)
    if (access === null) {
      log.warn('POST matter not found:', { matterId: id })
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    }
    if (!access) {
      log.warn('POST forbidden - no access to matter:', { matterId: id, userId: session.user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const description = formData.get('description') as string | null

    if (!file) {
      log.warn('POST missing file in form data')
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    log.debug('POST file details:', { fileName: file.name, size: file.size, type: file.type })

    const uploadDir = path.join(process.cwd(), 'uploads', 'matters', id)
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)
    log.debug('POST file written to:', { filePath })

    const attachment = await prisma.matterAttachment.create({
      data: {
        matterId: id,
        fileName,
        filePath,
        fileSizeBytes: file.size,
        mimeType: file.type || null,
        description: description || null,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    log.info('POST completed, created attachment:', { attachmentId: attachment.id, fileName, matterId: id })
    return NextResponse.json(
      {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSizeBytes: attachment.fileSizeBytes,
        mimeType: attachment.mimeType,
        description: attachment.description,
        uploadedAt: attachment.uploadedAt,
        uploadedBy: attachment.uploadedBy,
      },
      { status: 201 },
    )
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
