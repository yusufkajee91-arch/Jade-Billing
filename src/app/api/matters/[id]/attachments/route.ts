import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

  const attachments = await prisma.matterAttachment.findMany({
    where: { matterId: id },
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  })

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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const description = formData.get('description') as string | null

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'matters', id)
  await mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)

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
}
