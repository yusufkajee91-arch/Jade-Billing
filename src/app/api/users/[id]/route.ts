import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('users/[id]')

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
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('GET forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  log.debug('GET user id:', id)

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelectFields,
    })

    if (!user) {
      log.warn('GET user not found:', id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    log.info('GET completed successfully — user:', id)
    return NextResponse.json(user)
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('PATCH request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('PATCH unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('PATCH forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  log.debug('PATCH user id:', id)
  const body = await request.json()
  log.debug('PATCH body:', { ...body, password: body.password ? '[REDACTED]' : undefined })
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('PATCH validation failed:', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { password, ...rest } = parsed.data

  try {
    const updateData: Record<string, unknown> = { ...rest }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelectFields,
    })

    log.info('PATCH completed successfully — user updated:', id)
    return NextResponse.json(user)
  } catch (err) {
    log.error('PATCH failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
