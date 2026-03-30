import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/fee-schedules/items/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

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

  return NextResponse.json(item)
}

// DELETE /api/fee-schedules/items/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.feeScheduleItem.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
