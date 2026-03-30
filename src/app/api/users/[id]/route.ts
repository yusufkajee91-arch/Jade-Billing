import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  initials: z
    .string()
    .min(2)
    .max(3)
    .regex(/^[A-Z]+$/)
    .optional(),
  role: z.enum(['admin', 'fee_earner', 'assistant']).optional(),
  isActive: z.boolean().optional(),
  defaultFeeLevelId: z.string().optional().nullable(),
  monthlyTargetCents: z.number().int().min(0).optional().nullable(),
  password: z.string().min(8).optional(),
})

const userSelectFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  initials: true,
  role: true,
  isActive: true,
  defaultFeeLevelId: true,
  monthlyTargetCents: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelectFields,
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { password, ...rest } = parsed.data

  const updateData: Record<string, unknown> = { ...rest }
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12)
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: userSelectFields,
  })

  return NextResponse.json(user)
}
