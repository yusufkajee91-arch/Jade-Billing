import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('diary')

const createSchema = z.object({
  matterId: z.string().min(1, 'Matter is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  dueDate: z.string().min(1, 'Due date is required'),
  // assignedToId never required from client — server always falls back to session user
  assignedToId: z.string().optional().nullable(),
})

// GET /api/diary?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=mine|all&isCompleted=true|false
export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const scope = searchParams.get('scope') ?? 'mine'
  const isCompletedParam = searchParams.get('isCompleted')
  const isAdmin = session.user.role === 'admin'

  log.debug('GET query params:', { from, to, scope, isCompleted: isCompletedParam, isAdmin })

  try {
    const entries = await prisma.diaryEntry.findMany({
      where: {
        ...(from || to
          ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
        ...(scope === 'mine' || !isAdmin ? { assignedToId: session.user.id } : {}),
        ...(isCompletedParam !== null
          ? { isCompleted: isCompletedParam === 'true' }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        isCompleted: true,
        completedAt: true,
        createdAt: true,
        matter: { select: { id: true, matterCode: true, description: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, initials: true } },
        createdBy: { select: { id: true, initials: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    log.info(`GET completed successfully — ${entries.length} entries returned`)
    return NextResponse.json(
      entries.map((e) => ({
        ...e,
        dueDate: new Date(e.dueDate).toISOString().slice(0, 10),
        completedAt: e.completedAt ? new Date(e.completedAt).toISOString().slice(0, 10) : null,
        createdAt: new Date(e.createdAt).toISOString(),
      })),
    )
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

// POST /api/diary
export async function POST(request: NextRequest) {
  log.info('POST request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  log.debug('POST body:', body)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten()
    log.warn('POST validation failed:', details)
    return NextResponse.json({ error: 'Validation failed', details }, { status: 400 })
  }

  const { matterId, title, description, dueDate, assignedToId } = parsed.data

  try {
    const entry = await prisma.diaryEntry.create({
      data: {
        matterId,
        title,
        description: description ?? null,
        dueDate: new Date(dueDate),
        assignedToId: assignedToId ?? session.user.id,
        createdById: session.user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        isCompleted: true,
        completedAt: true,
        matter: { select: { id: true, matterCode: true, description: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, initials: true } },
        createdBy: { select: { id: true, initials: true } },
      },
    })

    log.info('POST completed successfully — entry created:', entry.id)
    return NextResponse.json(
      {
        ...entry,
        dueDate: new Date(entry.dueDate).toISOString().slice(0, 10),
        completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString().slice(0, 10) : null,
      },
      { status: 201 },
    )
  } catch (err) {
    log.error('POST failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
