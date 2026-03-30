import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseFnbCsv } from '@/lib/fnb-csv-parser'

// ─── GET /api/bank-statements ─────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const statements = await prisma.bankStatement.findMany({
    orderBy: { importedAt: 'desc' },
    include: {
      _count: { select: { lines: true } },
      importedBy: { select: { id: true, firstName: true, lastName: true, initials: true } },
    },
  })

  // Attach matched-line counts
  const statementIds = statements.map(s => s.id)
  const matchedCounts =
    statementIds.length > 0
      ? await prisma.bankStatementLine.groupBy({
          by: ['bankStatementId'],
          where: {
            bankStatementId: { in: statementIds },
            isReconciled: true,
          },
          _count: { id: true },
        })
      : []

  const matchedMap = Object.fromEntries(
    matchedCounts.map(m => [m.bankStatementId, m._count.id]),
  )

  const result = statements.map(s => ({
    ...s,
    matchedCount: matchedMap[s.id] ?? 0,
  }))

  return NextResponse.json(result)
}

// ─── POST /api/bank-statements ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file')
    const accountType = formData.get('accountType') as string | null

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!accountType || !['trust', 'business'].includes(accountType)) {
      return NextResponse.json(
        { error: 'accountType must be "trust" or "business"' },
        { status: 400 },
      )
    }

    const csvContent = await (file as File).text()
    const fileName = (file as File).name

    // Log first 500 chars so the server terminal shows what was received
    console.log('[bank-statements] received file:', fileName)
    console.log('[bank-statements] CSV preview:', JSON.stringify(csvContent.slice(0, 500)))

    let parsed
    try {
      parsed = parseFnbCsv(csvContent)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[bank-statements] parse error:', msg)
      return NextResponse.json({ error: `CSV parse error: ${msg}` }, { status: 422 })
    }

    console.log('[bank-statements] parsed lines:', parsed.lines.length)
    console.log('[bank-statements] accountNumber:', parsed.accountNumber)
    console.log('[bank-statements] first line:', parsed.lines[0] ?? null)

    if (parsed.lines.length === 0) {
      return NextResponse.json({ error: 'No transaction lines found in CSV' }, { status: 422 })
    }

    const statement = await prisma.$transaction(async tx => {
      const stmt = await tx.bankStatement.create({
        data: {
          accountType: accountType as 'trust' | 'business',
          fileName,
          accountNumber: parsed.accountNumber,
          accountDescription: parsed.accountDescription,
          statementFrom: parsed.statementFrom ?? undefined,
          statementTo: parsed.statementTo ?? undefined,
          openingBalanceCents:
            parsed.lines[0].balanceCents - parsed.lines[0].amountCents,
          closingBalanceCents: parsed.closingBalanceCents,
          importedById: session.user.id,
        },
      })

      await tx.bankStatementLine.createMany({
        data: parsed.lines.map(l => ({
          bankStatementId: stmt.id,
          lineNumber: l.lineNumber,
          transactionDate: l.transactionDate,
          amountCents: l.amountCents,
          balanceCents: l.balanceCents,
          description: l.description,
          reference: l.reference ?? undefined,
        })),
      })

      return stmt
    })

    const created = await prisma.bankStatement.findUnique({
      where: { id: statement.id },
      include: { _count: { select: { lines: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    // Top-level catch — guarantees a JSON response even if Next.js would otherwise return HTML
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[bank-statements POST] unhandled error:', msg)
    if (stack) console.error(stack)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
