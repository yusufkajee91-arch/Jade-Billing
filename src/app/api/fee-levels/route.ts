import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-levels')

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hourlyRateCents: z.number().int().min(0, 'Rate must be non-negative'),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    const feeLevels = await prisma.feeLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    log.debug('Fee levels found:', { count: feeLevels.length })
    log.info('GET completed successfully')
    return NextResponse.json(feeLevels)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('POST rejected: forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    log.debug('Request body:', body)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      log.warn('POST rejected: validation failed', parsed.error.flatten())
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const feeLevel = await prisma.feeLevel.create({ data: parsed.data })
    log.info('POST completed successfully', { id: feeLevel.id })
    return NextResponse.json(feeLevel, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
