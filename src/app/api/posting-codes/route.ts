import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  code: z.string().min(1, 'Code is required').toUpperCase(),
  description: z.string().min(1, 'Description is required'),
  defaultBillable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const postingCodes = await prisma.postingCode.findMany({
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })
  return NextResponse.json(postingCodes)
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

  const existing = await prisma.postingCode.findUnique({ where: { code: parsed.data.code } })
  if (existing) {
    return NextResponse.json({ error: 'A posting code with this code already exists' }, { status: 409 })
  }

  const postingCode = await prisma.postingCode.create({ data: parsed.data })
  return NextResponse.json(postingCode, { status: 201 })
}
