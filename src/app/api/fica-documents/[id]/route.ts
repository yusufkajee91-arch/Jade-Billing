import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile, unlink, rmdir } from 'fs/promises'
import path from 'path'

// ─── GET /api/fica-documents/[id]  (download) ────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params

  const doc = await prisma.ficaDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let buffer: Buffer
  try {
    buffer = await readFile(doc.filePath)
  } catch {
    return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}

// ─── DELETE /api/fica-documents/[id] ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const doc = await prisma.ficaDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Remove file from filesystem (best-effort)
  try { await unlink(doc.filePath) } catch { /* already gone */ }
  try { await rmdir(path.dirname(doc.filePath)) } catch { /* not empty or gone */ }

  await prisma.ficaDocument.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
