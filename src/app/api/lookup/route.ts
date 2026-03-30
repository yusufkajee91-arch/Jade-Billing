import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  switch (type) {
    case 'fee-earners': {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['fee_earner', 'admin'] },
        },
        select: { id: true, firstName: true, lastName: true, initials: true, role: true },
        orderBy: { firstName: 'asc' },
      })
      return NextResponse.json(users)
    }

    case 'matter-types': {
      const types = await prisma.matterType.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(types)
    }

    case 'departments': {
      const departments = await prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(departments)
    }

    case 'clients': {
      const clients = await prisma.client.findMany({
        where: { isActive: true },
        select: { id: true, clientCode: true, clientName: true },
        orderBy: { clientCode: 'asc' },
      })
      return NextResponse.json(clients)
    }

    case 'users': {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, initials: true, role: true },
        orderBy: { firstName: 'asc' },
      })
      return NextResponse.json(users)
    }

    case 'fee_levels': {
      const levels = await prisma.feeLevel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, hourlyRateCents: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(levels)
    }

    case 'posting_codes': {
      const codes = await prisma.postingCode.findMany({
        where: { isActive: true },
        select: { id: true, code: true, description: true, defaultBillable: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(codes)
    }

    default:
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  }
}
