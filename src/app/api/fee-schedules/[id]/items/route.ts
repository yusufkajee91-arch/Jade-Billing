import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('fee-schedules/[id]/items')

// GET /api/fee-schedules/[id]/items — items grouped by section
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    log.debug('Params:', { categoryId: id })

    const items = await prisma.feeScheduleItem.findMany({
      where: { categoryId: id },
      orderBy: [{ sortOrder: 'asc' }, { description: 'asc' }],
    })

    // Group by section preserving order of first appearance
    const sectionMap = new Map<string, typeof items>()
    for (const item of items) {
      if (!sectionMap.has(item.section)) sectionMap.set(item.section, [])
      sectionMap.get(item.section)!.push(item)
    }

    const grouped = Array.from(sectionMap.entries()).map(([section, sectionItems]) => ({
      section,
      items: sectionItems,
    }))

    log.debug('Items found:', { totalItems: items.length, sections: grouped.length })
    log.info('GET completed successfully')
    return NextResponse.json(grouped)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

// POST /api/fee-schedules/[id]/items — add item to category
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      log.warn('POST rejected: forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('Params:', { categoryId: id })
    const body = await req.json()
    log.debug('Request body:', body)
    const { section, description, officialFeeCents = 0, professionalFeeCents, sortOrder } = body

    if (!section || !description || professionalFeeCents == null) {
      log.warn('POST rejected: missing required fields', { section, description, professionalFeeCents })
      return NextResponse.json({ error: 'section, description, professionalFeeCents required' }, { status: 400 })
    }

    const item = await prisma.feeScheduleItem.create({
      data: {
        categoryId: id,
        section,
        description,
        officialFeeCents,
        professionalFeeCents,
        sortOrder: sortOrder ?? null,
      },
    })

    log.info('POST completed successfully', { id: item.id })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
