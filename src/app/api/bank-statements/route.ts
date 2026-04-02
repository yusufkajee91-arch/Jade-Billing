import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseFnbCsv } from '@/lib/fnb-csv-parser'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('bank-statements')

// ─── GET /api/bank-statements ─────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
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

    log.info('GET completed successfully, returned', result.length, 'statements')
    return NextResponse.json(result)
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

// ─── POST /api/bank-statements ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('POST rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('POST rejected: forbidden, role =', session.user.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      log.warn('POST rejected: expected multipart/form-data')
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file')
    const accountType = formData.get('accountType') as string | null

    if (!file || typeof file === 'string') {
      log.warn('POST rejected: file is required')
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!accountType || !['trust', 'business'].includes(accountType)) {
      log.warn('POST rejected: invalid accountType =', accountType)
      return NextResponse.json(
        { error: 'accountType must be "trust" or "business"' },
        { status: 400 },
      )
    }

    const csvContent = await (file as File).text()
    const fileName = (file as File).name

    log.debug('POST received file:', fileName)
    log.debug('POST CSV preview:', JSON.stringify(csvContent.slice(0, 500)))

    let parsed
    try {
      parsed = parseFnbCsv(csvContent)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('POST CSV parse error:', msg)
      return NextResponse.json({ error: `CSV parse error: ${msg}` }, { status: 422 })
    }

    log.debug('POST parsed lines:', parsed.lines.length)
    log.debug('POST accountNumber:', parsed.accountNumber)
    log.debug('POST first line:', parsed.lines[0] ?? null)

    if (parsed.lines.length === 0) {
      log.warn('POST rejected: no transaction lines found in CSV')
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

    log.info('POST completed successfully, created statement', statement.id, 'with', parsed.lines.length, 'lines')
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    log.error('POST failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
