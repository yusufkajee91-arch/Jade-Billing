import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const entry = await prisma.businessEntry.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } } },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(entry)
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
  await prisma.businessEntry.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
