import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('reports/invoice-register')

// GET /api/reports/invoice-register?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|draft_invoice|sent_invoice|paid
export async function GET(request: NextRequest) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('Unauthorized request — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status') ?? 'all'
  log.debug('Query params:', { from, to, status })

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(from || to
          ? { invoiceDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
        ...(status !== 'all' ? { status: status as never } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        clientName: true,
        matterCode: true,
        matterDescription: true,
        invoiceDate: true,
        subTotalCents: true,
        vatCents: true,
        totalCents: true,
        sentAt: true,
        paidAt: true,
      },
      orderBy: { invoiceDate: 'asc' },
    })
    log.debug('Invoices fetched:', { count: invoices.length })

    const totals = invoices.reduce(
      (acc, inv) => ({
        subTotalCents: acc.subTotalCents + inv.subTotalCents,
        vatCents: acc.vatCents + inv.vatCents,
        totalCents: acc.totalCents + inv.totalCents,
      }),
      { subTotalCents: 0, vatCents: 0, totalCents: 0 },
    )

    log.info('GET completed successfully', { invoiceCount: invoices.length, totalCents: totals.totalCents })
    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        ...inv,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        sentAt: inv.sentAt?.toISOString().slice(0, 10) ?? null,
        paidAt: inv.paidAt?.toISOString().slice(0, 10) ?? null,
      })),
      totals,
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
