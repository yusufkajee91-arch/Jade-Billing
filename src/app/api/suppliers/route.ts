import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('suppliers')

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactName: z.string().optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const activeParam = searchParams.get('active')
  log.debug('GET query params:', { q, active: activeParam })

  const where: Record<string, unknown> = {}
  if (activeParam === 'true') where.isActive = true
  if (activeParam === 'false') where.isActive = false
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
    ]
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    log.info(`GET completed successfully — ${suppliers.length} suppliers returned`)
    return NextResponse.json(suppliers)
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('POST unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    log.warn('POST forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  log.debug('POST body:', body)
  const parsed = supplierSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('POST validation failed:', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        ...parsed.data,
        isActive: parsed.data.isActive ?? true,
        createdById: session.user.id,
      },
    })

    log.info('POST completed successfully — supplier created:', supplier.id)
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    log.error('POST failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
