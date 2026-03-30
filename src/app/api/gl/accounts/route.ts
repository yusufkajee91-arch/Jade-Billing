import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const accounts = await prisma.glAccount.findMany({
    where: { isActive: true },
    orderBy: [{ accountType: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  })

  return NextResponse.json(accounts)
}
