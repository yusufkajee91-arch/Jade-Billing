import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('diary/[id]')

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignedToId: z.string().min(1).optional().nullable(),
  isCompleted: z.boolean().optional(),
})

// PATCH /api/diary/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('PATCH unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('PATCH diary entry id:', id)
  const body = await request.json()
  log.debug('PATCH body:', body)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('PATCH validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.diaryEntry.findUnique({ where: { id } })
  if (!existing) {
    log.warn('PATCH diary entry not found:', id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only creator, assignee, or admin can edit
  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && existing.createdById !== session.user.id && existing.assignedToId !== session.user.id) {
    log.warn('PATCH forbidden — user is not creator, assignee, or admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { isCompleted, dueDate, ...rest } = parsed.data

  try {
    const entry = await prisma.diaryEntry.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(isCompleted !== undefined
          ? {
              isCompleted,
              completedAt: isCompleted ? (existing.completedAt ?? new Date()) : null,
            }
          : {}),
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

    log.info('PATCH completed successfully — entry updated:', id)
    return NextResponse.json({
      ...entry,
      dueDate: new Date(entry.dueDate).toISOString().slice(0, 10),
      completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString().slice(0, 10) : null,
    })
  } catch (err) {
    log.error('PATCH failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

// DELETE /api/diary/[id]
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

  const { id } = await params
  log.debug('DELETE diary entry id:', id)

  const existing = await prisma.diaryEntry.findUnique({ where: { id } })
  if (!existing) {
    log.warn('DELETE diary entry not found:', id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && existing.createdById !== session.user.id) {
    log.warn('DELETE forbidden — user is not creator or admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prisma.diaryEntry.delete({ where: { id } })
    log.info('DELETE completed successfully — entry deleted:', id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    log.error('DELETE failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
