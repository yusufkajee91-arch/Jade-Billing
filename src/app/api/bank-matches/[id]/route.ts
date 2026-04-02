import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('bank-matches/[id]')

// ─── DELETE /api/bank-matches/[id] ───────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('DELETE rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('DELETE rejected: forbidden, role =', session.user.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('DELETE bank match id:', id)

    const match = await prisma.bankMatch.findUnique({ where: { id } })
    if (!match) {
      log.warn('DELETE rejected: not found, id =', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.bankMatch.delete({ where: { id } })
    log.info('DELETE completed successfully, id =', id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
