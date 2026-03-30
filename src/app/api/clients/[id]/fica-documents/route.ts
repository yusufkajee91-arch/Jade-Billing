import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  const docs = await prisma.ficaDocument.findMany({
    where: { clientId: id },
    orderBy: { uploadedAt: 'desc' },
    include: {
      uploadedBy: {
        select: { id: true, firstName: true, lastName: true, initials: true },
      },
    },
  })

  return NextResponse.json(docs)
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

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const documentType = formData.get('documentType') as string | null
  const notes = formData.get('notes') as string | null

  if (!file || !documentType) {
    return NextResponse.json(
      { error: 'file and documentType are required' },
      { status: 400 },
    )
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'fica', id)
  await mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)

  const doc = await prisma.ficaDocument.create({
    data: {
      clientId: id,
      documentType,
      fileName,
      filePath: filePath,
      fileSizeBytes: file.size,
      mimeType: file.type || null,
      notes: notes || null,
      uploadedById: session.user.id,
    },
  })

  // Update ficaLastUpdatedAt on client
  await prisma.client.update({
    where: { id },
    data: { ficaLastUpdatedAt: new Date() },
  })

  return NextResponse.json(doc, { status: 201 })
}
