import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── GET /api/bank-statements/[id] ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(statement)
}

// ─── DELETE /api/bank-statements/[id] ────────────────────────────────────────

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

  const existing = await prisma.bankStatement.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.bankStatement.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
