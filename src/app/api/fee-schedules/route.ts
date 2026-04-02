import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-schedules')

// GET /api/fee-schedules — list all categories with item counts
export async function GET() {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await prisma.feeScheduleCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { items: { where: { isActive: true } } } },
      },
    })

    log.debug('Categories found:', { count: categories.length })
    log.info('GET completed successfully')
    return NextResponse.json(categories)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

// POST /api/fee-schedules — create a new category
export async function POST(req: Request) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      log.warn('POST rejected: forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    log.debug('Request body:', body)
    const { name, jurisdiction, currency = 'ZAR' } = body
    if (!name || !jurisdiction) {
      log.warn('POST rejected: missing required fields', { name, jurisdiction })
      return NextResponse.json({ error: 'name and jurisdiction are required' }, { status: 400 })
    }

    const category = await prisma.feeScheduleCategory.create({
      data: { name, jurisdiction, currency },
    })

    log.info('POST completed successfully', { id: category.id })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
