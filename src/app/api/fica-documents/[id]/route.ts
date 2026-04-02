import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile, unlink, rmdir } from 'fs/promises'
import path from 'path'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fica-documents/[id]')

// ─── GET /api/fica-documents/[id]  (download) ────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received (download)')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('GET document id:', id)

  try {
    const doc = await prisma.ficaDocument.findUnique({ where: { id } })
    if (!doc) {
      log.warn('GET document not found:', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    log.debug('GET reading file:', doc.filePath)
    let buffer: Buffer
    try {
      buffer = await readFile(doc.filePath)
    } catch {
      log.warn('GET file not found on disk:', doc.filePath)
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
    }

    log.info('GET completed successfully — serving file:', doc.fileName, `(${buffer.length} bytes)`)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': doc.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

// ─── DELETE /api/fica-documents/[id] ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('DELETE unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('DELETE forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  log.debug('DELETE document id:', id)

  try {
    const doc = await prisma.ficaDocument.findUnique({ where: { id } })
    if (!doc) {
      log.warn('DELETE document not found:', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Remove file from filesystem (best-effort)
    try { await unlink(doc.filePath) } catch { /* already gone */ }
    try { await rmdir(path.dirname(doc.filePath)) } catch { /* not empty or gone */ }

    await prisma.ficaDocument.delete({ where: { id } })

    log.info('DELETE completed successfully — document deleted:', id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    log.error('DELETE failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
