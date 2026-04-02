import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('clients/[id]/fica-documents')

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

  try {
    const docs = await prisma.ficaDocument.findMany({
      where: { clientId: id },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, initials: true },
        },
      },
    })

    log.info('GET completed successfully', { count: docs.length })
    return NextResponse.json(docs)
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
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('POST client id:', id)

  try {
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      log.warn('POST client not found', { id })
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string | null
    const notes = formData.get('notes') as string | null
    log.debug('POST form data:', { documentType, fileName: file?.name, fileSize: file?.size, notes })

    if (!file || !documentType) {
      log.warn('POST validation failed - missing file or documentType')
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
    log.debug('POST file written to:', filePath)

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

    log.info('POST completed successfully', { docId: doc.id, documentType })
    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
