import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('search')

export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  log.debug('GET search query:', q)

  if (q.length < 2) {
    log.warn('GET query too short:', q)
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 },
    )
  }

  const isAdmin = session.user.role === 'admin'
  const userId = session.user.id

  try {
    // Search clients
    const clientsPromise = prisma.client.findMany({
      where: {
        OR: [
          { clientCode: { contains: q, mode: 'insensitive' } },
          { clientName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        clientCode: true,
        clientName: true,
        ficaStatus: true,
      },
      take: 5,
      orderBy: { clientCode: 'asc' },
    })

    // Search matters with access control
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matterWhere: any = {
      OR: [
        { matterCode: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { client: { clientName: { contains: q, mode: 'insensitive' } } },
        { client: { clientCode: { contains: q, mode: 'insensitive' } } },
      ],
    }

    if (!isAdmin) {
      matterWhere.AND = [
        {
          OR: [
            { ownerId: userId },
            { matterUsers: { some: { userId } } },
          ],
        },
      ]
    }

    const mattersPromise = prisma.matter.findMany({
      where: matterWhere,
      select: {
        id: true,
        matterCode: true,
        description: true,
        status: true,
        client: { select: { clientCode: true, clientName: true } },
      },
      take: 8,
      orderBy: { matterCode: 'asc' },
    })

    const [clients, matters] = await Promise.all([clientsPromise, mattersPromise])

    log.info(`GET completed successfully — ${clients.length} clients, ${matters.length} matters`)
    return NextResponse.json({
      clients: clients.map((c) => ({ ...c, type: 'client' as const })),
      matters: matters.map((m) => ({
        id: m.id,
        matterCode: m.matterCode,
        description: m.description,
        clientCode: m.client.clientCode,
        clientName: m.client.clientName,
        status: m.status,
        type: 'matter' as const,
      })),
    })
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
