import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/fee-schedules — list all categories with item counts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.feeScheduleCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { items: { where: { isActive: true } } } },
    },
  })

  return NextResponse.json(categories)
}

// POST /api/fee-schedules — create a new category
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, jurisdiction, currency = 'ZAR' } = body
  if (!name || !jurisdiction) {
    return NextResponse.json({ error: 'name and jurisdiction are required' }, { status: 400 })
  }

  const category = await prisma.feeScheduleCategory.create({
    data: { name, jurisdiction, currency },
  })

  return NextResponse.json(category, { status: 201 })
}
