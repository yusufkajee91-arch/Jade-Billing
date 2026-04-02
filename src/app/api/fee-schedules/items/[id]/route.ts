import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-schedules/items/[id]')

// PATCH /api/fee-schedules/items/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      log.warn('PATCH rejected: forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('Params:', { id })
    const body = await req.json()
    log.debug('Request body:', body)

    const item = await prisma.feeScheduleItem.update({
      where: { id },
      data: {
        ...(body.section != null && { section: body.section }),
        ...(body.description != null && { description: body.description }),
        ...(body.officialFeeCents != null && { officialFeeCents: body.officialFeeCents }),
        ...(body.professionalFeeCents != null && { professionalFeeCents: body.professionalFeeCents }),
        ...(body.vatRate != null && { vatRate: body.vatRate }),
        ...(body.isActive != null && { isActive: body.isActive }),
        ...(body.sortOrder != null && { sortOrder: body.sortOrder }),
      },
    })

    log.info('PATCH completed successfully', { id })
    return NextResponse.json(item)
  } catch (error) {
    log.error('PATCH failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

// DELETE /api/fee-schedules/items/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      log.warn('DELETE rejected: forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('Params:', { id })
    await prisma.feeScheduleItem.delete({ where: { id } })
    log.info('DELETE completed successfully', { id })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
