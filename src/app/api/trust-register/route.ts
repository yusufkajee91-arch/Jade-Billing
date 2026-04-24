import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('trust-register')

// GET /api/trust-register?asAt=2025-12-31
// Returns every matter that has trust entries, with its balance (optionally as-at a date).
export async function GET(request: NextRequest) {
  log.info('GET request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('GET rejected: unauthorised')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('GET rejected: forbidden', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const asAtParam = searchParams.get('asAt')
    const asAt = asAtParam ? new Date(asAtParam) : null
    log.debug('GET params:', { asAt: asAtParam })

    const asAtFilter = asAt ? Prisma.sql`AND te.entry_date <= ${asAt}` : Prisma.empty

    const rows = await prisma.$queryRaw<
      {
        matter_id: string
        matter_code: string
        description: string
        client_name: string
        balance_cents: bigint
        last_entry_date: Date | null
      }[]
    >`
      SELECT
        m.id            AS matter_id,
        m.matter_code,
        m.description,
        c.client_name,
        COALESCE(SUM(
          CASE
            WHEN te.entry_type IN ('trust_receipt','trust_transfer_in','collection_receipt')
              THEN te.amount_cents
            WHEN te.entry_type IN ('trust_payment','trust_transfer_out')
              THEN -te.amount_cents
            ELSE 0
          END
        ), 0)            AS balance_cents,
        MAX(te.entry_date) AS last_entry_date
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      JOIN trust_entries te ON te.matter_id = m.id
      WHERE 1=1 ${asAtFilter}
      GROUP BY m.id, m.matter_code, m.description, c.client_name
      ORDER BY c.client_name, m.matter_code
    `

    const result = rows.map((r) => ({
      matterId: r.matter_id,
      matterCode: r.matter_code,
      description: r.description,
      clientName: r.client_name,
      balanceCents: Number(r.balance_cents),
      lastEntryDate: r.last_entry_date,
    }))

    const totalBalanceCents = result.reduce((s, r) => s + r.balanceCents, 0)

    log.info('GET completed successfully,', result.length, 'matters, totalBalanceCents =', totalBalanceCents)
    return NextResponse.json({ matters: result, totalBalanceCents })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
