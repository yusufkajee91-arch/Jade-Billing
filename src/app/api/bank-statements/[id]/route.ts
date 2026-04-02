import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('bank-statements/[id]')

// ─── GET /api/bank-statements/[id] ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('GET rejected: forbidden, role =', session.user.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('GET bank statement id:', id)

    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      include: {
        importedBy: { select: { id: true, firstName: true, lastName: true, initials: true } },
        lines: {
          orderBy: [{ transactionDate: 'asc' }, { lineNumber: 'asc' }],
          include: {
            matches: {
              include: {
                trustEntry: {
                  select: {
                    id: true,
                    entryType: true,
                    entryDate: true,
                    amountCents: true,
                    narration: true,
                    referenceNumber: true,
                  },
                },
                businessEntry: {
                  select: {
                    id: true,
                    entryType: true,
                    entryDate: true,
                    amountCents: true,
                    narration: true,
                    referenceNumber: true,
                  },
                },
                matchedBy: {
                  select: { id: true, firstName: true, lastName: true, initials: true },
                },
              },
            },
          },
        },
      },
    })

    if (!statement) {
      log.warn('GET rejected: not found, id =', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    log.info('GET completed successfully, statement has', statement.lines.length, 'lines')
    return NextResponse.json(statement)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

// ─── DELETE /api/bank-statements/[id] ────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('DELETE request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('DELETE rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('DELETE rejected: forbidden, role =', session.user.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    log.debug('DELETE bank statement id:', id)

    const existing = await prisma.bankStatement.findUnique({ where: { id } })
    if (!existing) {
      log.warn('DELETE rejected: not found, id =', id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.bankStatement.delete({ where: { id } })
    log.info('DELETE completed successfully, id =', id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
