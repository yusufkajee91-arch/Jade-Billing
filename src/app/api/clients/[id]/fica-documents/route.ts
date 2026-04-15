import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, FICA_BUCKET } from '@/lib/supabase-storage'
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

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${id}/${Date.now()}-${safeName}`

    // Infer MIME type from extension when browser doesn't provide one
    const mimeFromExt: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
    const contentType = file.type || mimeFromExt[ext] || 'application/pdf'

    const { error: uploadError } = await supabaseAdmin.storage
      .from(FICA_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      log.error('POST Supabase upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', debug: process.env.NODE_ENV !== 'production' ? { message: uploadError.message } : undefined },
        { status: 500 },
      )
    }

    log.debug('POST file uploaded to Supabase:', storagePath)

    const doc = await prisma.ficaDocument.create({
      data: {
        clientId: id,
        documentType,
        fileName: file.name,
        filePath: storagePath,
        fileSizeBytes: file.size,
        mimeType: contentType,
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
