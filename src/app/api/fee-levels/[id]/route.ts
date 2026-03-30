import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const feeLevel = await prisma.feeLevel.update({ where: { id }, data: parsed.data })
    return NextResponse.json(feeLevel)
  } catch {
    return NextResponse.json({ error: 'Fee level not found' }, { status: 404 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Check if any users reference this fee level
  const usersCount = await prisma.user.count({ where: { defaultFeeLevelId: id } })
  if (usersCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${usersCount} user(s) have this as their default fee level. Deactivate instead.` },
      { status: 409 },
    )
  }

  try {
    await prisma.feeLevel.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Fee level not found' }, { status: 404 })
  }
}
