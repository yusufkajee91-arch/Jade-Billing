import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('gl/accounts')

export async function GET() {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const accounts = await prisma.glAccount.findMany({
      where: { isActive: true },
      orderBy: [{ accountType: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    })

    log.debug('Accounts found:', { count: accounts.length })
    log.info('GET completed successfully')
    return NextResponse.json(accounts)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
