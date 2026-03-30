import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const supplier = await prisma.supplier.findUnique({ where: { id } })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(supplier)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = supplierUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(supplier)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { id } = await params
  await prisma.supplier.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
