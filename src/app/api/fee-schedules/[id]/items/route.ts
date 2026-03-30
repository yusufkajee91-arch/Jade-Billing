import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/fee-schedules/[id]/items — items grouped by section
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

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

  return NextResponse.json(grouped)
}

// POST /api/fee-schedules/[id]/items — add item to category
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { section, description, officialFeeCents = 0, professionalFeeCents, sortOrder } = body

  if (!section || !description || professionalFeeCents == null) {
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

  return NextResponse.json(item, { status: 201 })
}
