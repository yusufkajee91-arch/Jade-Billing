import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('debtors')

export async function GET() {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('GET forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: 'sent_invoice' },
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        clientName: true,
        matterCode: true,
        invoiceDate: true,
        totalCents: true,
      },
      orderBy: { invoiceDate: 'asc' },
    })

    log.debug(`GET found ${invoices.length} sent invoices`)

    const today = Date.now()

    // Group by client and accumulate age buckets
    const byClient = new Map<string, {
      clientId: string
      clientName: string
      currentCents: number   // 0-30 days
      thirtyCents: number    // 31-60 days
      sixtyCents: number     // 61-90 days
      ninetyCents: number    // 91+ days
      totalCents: number
      invoices: Array<{
        id: string
        invoiceNumber: string
        matterCode: string
        invoiceDate: string
        totalCents: number
        ageDays: number
      }>
    }>()

    for (const inv of invoices) {
      const ageDays = Math.floor((today - new Date(inv.invoiceDate).getTime()) / 86_400_000)
      const entry = byClient.get(inv.clientId) ?? {
        clientId: inv.clientId,
        clientName: inv.clientName,
        currentCents: 0,
        thirtyCents: 0,
        sixtyCents: 0,
        ninetyCents: 0,
        totalCents: 0,
        invoices: [],
      }

      if (ageDays <= 30) entry.currentCents += inv.totalCents
      else if (ageDays <= 60) entry.thirtyCents += inv.totalCents
      else if (ageDays <= 90) entry.sixtyCents += inv.totalCents
      else entry.ninetyCents += inv.totalCents
      entry.totalCents += inv.totalCents

      entry.invoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        matterCode: inv.matterCode,
        invoiceDate: inv.invoiceDate.toISOString(),
        totalCents: inv.totalCents,
        ageDays,
      })

      byClient.set(inv.clientId, entry)
    }

    const debtors = Array.from(byClient.values()).sort((a, b) => b.totalCents - a.totalCents)
    const grandTotal = debtors.reduce((s, d) => s + d.totalCents, 0)

    log.info(`GET completed successfully — ${debtors.length} debtors, grand total: ${grandTotal}`)
    return NextResponse.json({ debtors, grandTotal })
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
