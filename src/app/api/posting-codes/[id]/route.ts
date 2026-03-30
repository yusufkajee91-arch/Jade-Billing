import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  code: z.string().min(1).toUpperCase().optional(),
  description: z.string().min(1).optional(),
  defaultBillable: z.boolean().optional(),
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

  // Check for duplicate code on update
  if (parsed.data.code) {
    const conflict = await prisma.postingCode.findFirst({
      where: { code: parsed.data.code, NOT: { id } },
    })
    if (conflict) {
      return NextResponse.json({ error: 'A posting code with this code already exists' }, { status: 409 })
    }
  }

  try {
    const postingCode = await prisma.postingCode.update({ where: { id }, data: parsed.data })
    return NextResponse.json(postingCode)
  } catch {
    return NextResponse.json({ error: 'Posting code not found' }, { status: 404 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const entriesCount = await prisma.feeEntry.count({ where: { postingCodeId: id } })
  if (entriesCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${entriesCount} fee entr${entriesCount === 1 ? 'y' : 'ies'} use this code. Deactivate instead.` },
      { status: 409 },
    )
  }

  try {
    await prisma.postingCode.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Posting code not found' }, { status: 404 })
  }
}
