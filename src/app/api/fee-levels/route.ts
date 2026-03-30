import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hourlyRateCents: z.number().int().min(0, 'Rate must be non-negative'),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const feeLevels = await prisma.feeLevel.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(feeLevels)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const feeLevel = await prisma.feeLevel.create({ data: parsed.data })
  return NextResponse.json(feeLevel, { status: 201 })
}
