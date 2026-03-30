import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/kpis
// Returns the 4 dashboard KPI values as live figures.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  try {
    const [trustIn, trustOut, unsentInv, draftBill, debtorsInv] = await Promise.all([
      // Trust inflows
      prisma.trustEntry.aggregate({
        where: { entryType: { in: ['trust_receipt', 'trust_transfer_in', 'collection_receipt'] } },
        _sum: { amountCents: true },
      }),
      // Trust outflows
      prisma.trustEntry.aggregate({
        where: { entryType: { in: ['trust_payment', 'trust_transfer_out'] } },
        _sum: { amountCents: true },
      }),
      // Unsent (draft) invoices
      prisma.invoice.aggregate({
        where: { status: 'draft_invoice' },
        _sum: { totalCents: true },
      }),
      // Unbilled billable fee entries
      prisma.feeEntry.aggregate({
        where: { isBillable: true, isInvoiced: false },
        _sum: { totalCents: true },
      }),
      // Sent (unpaid) invoices = debtors
      prisma.invoice.aggregate({
        where: { status: 'sent_invoice' },
        _sum: { totalCents: true },
      }),
    ])

    return NextResponse.json({
      heldInTrustCents:
        (trustIn._sum.amountCents ?? 0) - (trustOut._sum.amountCents ?? 0),
      unsentInvoicesCents: unsentInv._sum.totalCents ?? 0,
      draftBillableCents: draftBill._sum.totalCents ?? 0,
      debtorsOutstandingCents: debtorsInv._sum.totalCents ?? 0,
    })
  } catch (err) {
    console.error('[GET /api/dashboard/kpis]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
