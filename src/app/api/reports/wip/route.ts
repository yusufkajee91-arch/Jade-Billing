import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/wip')

// GET /api/reports/wip
// Work-in-progress: all unbilled billable fee entries grouped by matter.
export async function GET() {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('Unauthorized request — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const entries = await prisma.feeEntry.findMany({
      where: { isBillable: true, isInvoiced: false },
      select: {
        id: true,
        entryType: true,
        entryDate: true,
        narration: true,
        durationMinutesBilled: true,
        totalCents: true,
        matter: {
          select: {
            id: true,
            matterCode: true,
            description: true,
            client: { select: { clientName: true } },
          },
        },
        feeEarner: { select: { initials: true, firstName: true, lastName: true } },
      },
      orderBy: [{ matter: { matterCode: 'asc' } }, { entryDate: 'asc' }],
    })
    log.debug('Unbilled fee entries fetched:', { count: entries.length })

    // Group by matter
    type WipMatter = {
      matterId: string
      matterCode: string
      description: string
      clientName: string
      entryCount: number
      totalMinutes: number
      totalCents: number
    }

    const mattersMap = new Map<string, WipMatter>()

    for (const e of entries) {
      const mid = e.matter.id
      if (!mattersMap.has(mid)) {
        mattersMap.set(mid, {
          matterId: mid,
          matterCode: e.matter.matterCode,
          description: e.matter.description,
          clientName: e.matter.client.clientName,
          entryCount: 0,
          totalMinutes: 0,
          totalCents: 0,
        })
      }
      const m = mattersMap.get(mid)!
      m.entryCount += 1
      m.totalMinutes += e.durationMinutesBilled ?? 0
      m.totalCents += e.totalCents
    }

    const matters = Array.from(mattersMap.values()).sort((a, b) =>
      a.matterCode.localeCompare(b.matterCode),
    )

    const grandTotalCents = matters.reduce((s, m) => s + m.totalCents, 0)
    const grandTotalMinutes = matters.reduce((s, m) => s + m.totalMinutes, 0)

    log.info('GET completed successfully', { matterCount: matters.length, grandTotalCents, grandTotalMinutes })
    return NextResponse.json({ matters, grandTotalCents, grandTotalMinutes })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
