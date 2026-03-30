import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── DELETE /api/bank-matches/[id] ───────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const match = await prisma.bankMatch.findUnique({ where: { id } })
  if (!match) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.bankMatch.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
