import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('posting-codes/[id]')

const updateSchema = z.object({
  code: z.string().min(1).toUpperCase().optional(),
  description: z.string().min(1).optional(),
  defaultBillable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  log.info('PATCH request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('PATCH rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('PATCH rejected: forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('Params:', { id })
    const body = await request.json()
    log.debug('Request body:', body)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('PATCH rejected: validation failed', parsed.error.flatten())
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    // Check for duplicate code on update
    if (parsed.data.code) {
      const conflict = await prisma.postingCode.findFirst({
        where: { code: parsed.data.code, NOT: { id } },
      })
      if (conflict) {
        log.warn('PATCH rejected: duplicate code', { code: parsed.data.code })
        return NextResponse.json({ error: 'A posting code with this code already exists' }, { status: 409 })
      }
    }

    try {
      const postingCode = await prisma.postingCode.update({ where: { id }, data: parsed.data })
      log.info('PATCH completed successfully', { id })
      return NextResponse.json(postingCode)
    } catch {
      log.warn('PATCH rejected: posting code not found', { id })
      return NextResponse.json({ error: 'Posting code not found' }, { status: 404 })
    }
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('DELETE rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('DELETE rejected: forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('Params:', { id })

    const entriesCount = await prisma.feeEntry.count({ where: { postingCodeId: id } })
    if (entriesCount > 0) {
      log.warn('DELETE rejected: posting code in use', { id, entriesCount })
      return NextResponse.json(
        { error: `Cannot delete: ${entriesCount} fee entr${entriesCount === 1 ? 'y' : 'ies'} use this code. Deactivate instead.` },
        { status: 409 },
      )
    }

    try {
      await prisma.postingCode.delete({ where: { id } })
      log.info('DELETE completed successfully', { id })
      return NextResponse.json({ ok: true })
    } catch {
      log.warn('DELETE rejected: posting code not found', { id })
      return NextResponse.json({ error: 'Posting code not found' }, { status: 404 })
    }
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
