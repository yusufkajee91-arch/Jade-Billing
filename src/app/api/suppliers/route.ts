import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactName: z.string().optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const activeParam = searchParams.get('active')

  const where: Record<string, unknown> = {}
  if (activeParam === 'true') where.isActive = true
  if (activeParam === 'false') where.isActive = false
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(suppliers)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = supplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      isActive: parsed.data.isActive ?? true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json(supplier, { status: 201 })
}
