import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('business-entries/[id]')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('GET business entry id:', id)
    const entry = await prisma.businessEntry.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, name: true } } },
    })
    if (!entry) {
      log.warn('GET rejected: not found, id =', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    log.info('GET completed successfully')
    return NextResponse.json(entry)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

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
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const { id } = await params
    log.debug('DELETE business entry id:', id)
    await prisma.businessEntry.delete({ where: { id } })
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
