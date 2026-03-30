import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params

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

  return NextResponse.json(associations)
}

const createSchema = z.object({
  associatedMatterId: z.string().min(1),
  relationshipNote: z.string().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { associatedMatterId, relationshipNote } = parsed.data

  if (associatedMatterId === id) {
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
    return NextResponse.json({ error: 'Association already exists' }, { status: 409 })
  }

  const association = await prisma.matterAssociation.create({
    data: { matterId: id, associatedMatterId, relationshipNote: relationshipNote ?? null },
    include: { associatedMatter: { select: matterSelect } },
  })

  return NextResponse.json(association, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const associatedMatterId = searchParams.get('associatedMatterId')

  if (!associatedMatterId) {
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
    return NextResponse.json({ error: 'Association not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
