import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('posting-codes')

const createSchema = z.object({
  code: z.string().min(1, 'Code is required').toUpperCase(),
  description: z.string().min(1, 'Description is required'),
  defaultBillable: z.boolean().optional(),
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
    if (session.user.role !== 'admin') {
      log.warn('GET rejected: forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const postingCodes = await prisma.postingCode.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    })
    log.debug('Posting codes found:', { count: postingCodes.length })
    log.info('GET completed successfully')
    return NextResponse.json(postingCodes)
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

    const existing = await prisma.postingCode.findUnique({ where: { code: parsed.data.code } })
    if (existing) {
      log.warn('POST rejected: duplicate code', { code: parsed.data.code })
      return NextResponse.json({ error: 'A posting code with this code already exists' }, { status: 409 })
    }

    const postingCode = await prisma.postingCode.create({ data: parsed.data })
    log.info('POST completed successfully', { id: postingCode.id, code: postingCode.code })
    return NextResponse.json(postingCode, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
