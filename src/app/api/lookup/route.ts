import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('lookup')

export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  log.debug('GET lookup type:', type)

  try {
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
        log.info(`GET completed successfully — ${users.length} fee-earners returned`)
        return NextResponse.json(users)
      }

      case 'matter-types': {
        const types = await prisma.matterType.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: 'asc' },
        })
        log.info(`GET completed successfully — ${types.length} matter-types returned`)
        return NextResponse.json(types)
      }

      case 'departments': {
        const departments = await prisma.department.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: 'asc' },
        })
        log.info(`GET completed successfully — ${departments.length} departments returned`)
        return NextResponse.json(departments)
      }

      case 'clients': {
        const clients = await prisma.client.findMany({
          where: { isActive: true },
          select: { id: true, clientCode: true, clientName: true },
          orderBy: { clientCode: 'asc' },
        })
        log.info(`GET completed successfully — ${clients.length} clients returned`)
        return NextResponse.json(clients)
      }

      case 'users': {
        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, initials: true, role: true },
          orderBy: { firstName: 'asc' },
        })
        log.info(`GET completed successfully — ${users.length} users returned`)
        return NextResponse.json(users)
      }

      case 'fee_levels': {
        const levels = await prisma.feeLevel.findMany({
          where: { isActive: true },
          select: { id: true, name: true, hourlyRateCents: true },
          orderBy: { sortOrder: 'asc' },
        })
        log.info(`GET completed successfully — ${levels.length} fee_levels returned`)
        return NextResponse.json(levels)
      }

      case 'posting_codes': {
        const codes = await prisma.postingCode.findMany({
          where: { isActive: true },
          select: { id: true, code: true, description: true, defaultBillable: true },
          orderBy: { sortOrder: 'asc' },
        })
        log.info(`GET completed successfully — ${codes.length} posting_codes returned`)
        return NextResponse.json(codes)
      }

      default:
        log.warn('GET invalid type parameter:', type)
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
