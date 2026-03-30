import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  initials: z
    .string()
    .min(2, 'Initials must be 2-3 characters')
    .max(3, 'Initials must be 2-3 characters')
    .regex(/^[A-Z]+$/, 'Initials must be uppercase letters only'),
  role: z.enum(['admin', 'fee_earner', 'assistant']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  defaultFeeLevelId: z.string().optional().nullable(),
  monthlyTargetCents: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: userSelectFields,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { email, password, ...rest } = parsed.data

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'A user with this email address already exists' },
      { status: 409 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      ...rest,
    },
    select: userSelectFields,
  })

  return NextResponse.json(user, { status: 201 })
}
