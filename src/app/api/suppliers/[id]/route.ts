import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('suppliers/[id]')

const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('GET supplier id:', id)

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) {
      log.warn('GET supplier not found:', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    log.info('GET completed successfully — supplier:', id)
    return NextResponse.json(supplier)
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

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
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    log.warn('PATCH forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  log.debug('PATCH supplier id:', id)
  const body = await request.json()
  log.debug('PATCH body:', body)
  const parsed = supplierUpdateSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('PATCH validation failed:', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: parsed.data,
    })

    log.info('PATCH completed successfully — supplier updated:', id)
    return NextResponse.json(supplier)
  } catch (err) {
    log.error('PATCH failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

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
  if (session.user.role !== 'admin') {
    log.warn('DELETE forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { id } = await params
  log.debug('DELETE supplier id:', id)

  try {
    await prisma.supplier.delete({ where: { id } })
    log.info('DELETE completed successfully — supplier deleted:', id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    log.error('DELETE failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
