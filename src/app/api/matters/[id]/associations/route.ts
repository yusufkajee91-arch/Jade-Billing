import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('matters/[id]/associations')

const matterSelect = {
  id: true,
  matterCode: true,
  description: true,
  status: true,
  client: { select: { id: true, clientName: true, clientCode: true } },
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    log.debug('GET associations for matter:', { matterId: id })

    const [asPrimary, asAssociated] = await Promise.all([
      prisma.matterAssociation.findMany({
        where: { matterId: id },
        include: { associatedMatter: { select: matterSelect } },
      }),
      prisma.matterAssociation.findMany({
        where: { associatedMatterId: id },
        include: { matter: { select: matterSelect } },
      }),
    ])
    log.debug('GET raw associations:', { asPrimaryCount: asPrimary.length, asAssociatedCount: asAssociated.length })

    // Flatten both directions into a unified list, deduplicated by paired matter id
    const seen = new Set<string>()
    const associations = []

    for (const a of asPrimary) {
      if (!seen.has(a.associatedMatterId)) {
        seen.add(a.associatedMatterId)
        associations.push({
          matterId: a.matterId,
          associatedMatterId: a.associatedMatterId,
          relationshipNote: a.relationshipNote,
          relatedMatter: a.associatedMatter,
        })
      }
    }

    for (const a of asAssociated) {
      if (!seen.has(a.matterId)) {
        seen.add(a.matterId)
        associations.push({
          matterId: a.matterId,
          associatedMatterId: a.associatedMatterId,
          relationshipNote: a.relationshipNote,
          relatedMatter: a.matter,
        })
      }
    }

    log.info(`GET completed, returning ${associations.length} associations for matter ${id}`)
    return NextResponse.json(associations)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

const createSchema = z.object({
  associatedMatterId: z.string().min(1),
  relationshipNote: z.string().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    log.debug('POST body:', { matterId: id, associatedMatterId: body.associatedMatterId })
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST validation failed:', parsed.error.flatten())
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { associatedMatterId, relationshipNote } = parsed.data

    if (associatedMatterId === id) {
      log.warn('POST rejected - self-association:', { matterId: id })
      return NextResponse.json({ error: 'Cannot associate a matter with itself' }, { status: 400 })
    }

    // Check if association already exists in either direction
    const existing = await prisma.matterAssociation.findFirst({
      where: {
        OR: [
          { matterId: id, associatedMatterId },
          { matterId: associatedMatterId, associatedMatterId: id },
        ],
      },
    })
    if (existing) {
      log.warn('POST rejected - association already exists:', { matterId: id, associatedMatterId })
      return NextResponse.json({ error: 'Association already exists' }, { status: 409 })
    }

    const association = await prisma.matterAssociation.create({
      data: { matterId: id, associatedMatterId, relationshipNote: relationshipNote ?? null },
      include: { associatedMatter: { select: matterSelect } },
    })

    log.info('POST completed, created association:', { matterId: id, associatedMatterId })
    return NextResponse.json(association, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('DELETE unauthorised - no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const associatedMatterId = searchParams.get('associatedMatterId')
    log.debug('DELETE association:', { matterId: id, associatedMatterId })

    if (!associatedMatterId) {
      log.warn('DELETE missing associatedMatterId param')
      return NextResponse.json({ error: 'associatedMatterId is required' }, { status: 400 })
    }

    // Try both directions
    const deleted = await prisma.matterAssociation.deleteMany({
      where: {
        OR: [
          { matterId: id, associatedMatterId },
          { matterId: associatedMatterId, associatedMatterId: id },
        ],
      },
    })

    if (deleted.count === 0) {
      log.warn('DELETE association not found:', { matterId: id, associatedMatterId })
      return NextResponse.json({ error: 'Association not found' }, { status: 404 })
    }

    log.info('DELETE completed, removed association:', { matterId: id, associatedMatterId, deletedCount: deleted.count })
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
