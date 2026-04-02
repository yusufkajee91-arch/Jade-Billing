import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('upload')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function POST(request: NextRequest) {
  log.info('POST request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      log.warn('POST no file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    log.debug('POST file details:', { name: file.name, size: file.size, type: file.type })

    if (file.size > MAX_FILE_SIZE) {
      log.warn('POST file too large:', file.size)
      return NextResponse.json(
        { error: 'File size exceeds the 10 MB limit' },
        { status: 400 },
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      log.warn('POST file type not allowed:', file.type)
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 },
      )
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const ext = path.extname(file.name)
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, '-')
    const fileName = `${Date.now()}-${baseName}${ext}`
    const filePath = path.join(uploadsDir, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    log.info('POST completed successfully — file uploaded:', fileName)
    return NextResponse.json({
      filePath: `/uploads/${fileName}`,
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (err) {
    log.error('POST failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
