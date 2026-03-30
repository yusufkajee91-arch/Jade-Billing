import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { StatementPDF } from '@/lib/statement-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, clientCode: true, clientName: true },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const firmSettings = await prisma.firmSettings.findFirst({
    include: { offices: { where: { isPrimary: true }, take: 1 } },
  })

  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: id,
      status: { in: ['sent_invoice', 'paid'] },
      ...(dateFrom || dateTo
        ? { invoiceDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
        : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      matterCode: true,
      matterDescription: true,
      invoiceDate: true,
      totalCents: true,
      status: true,
    },
    orderBy: { invoiceDate: 'asc' },
  })

  const receipts = await prisma.businessEntry.findMany({
    where: {
      entryType: 'matter_receipt',
      matter: { clientId: id },
      ...(dateFrom || dateTo
        ? { entryDate: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
        : {}),
    },
    select: {
      id: true,
      referenceNumber: true,
      narration: true,
      entryDate: true,
      amountCents: true,
      matter: { select: { matterCode: true } },
    },
    orderBy: { entryDate: 'asc' },
  })

  const rows = [
    ...invoices.map(inv => ({
      date: inv.invoiceDate.toISOString().slice(0, 10),
      type: 'invoice' as const,
      reference: inv.invoiceNumber,
      description: `${inv.matterCode} — ${inv.matterDescription}`,
      debitCents: inv.totalCents,
      creditCents: 0,
    })),
    ...receipts.map(r => ({
      date: r.entryDate.toISOString().slice(0, 10),
      type: 'receipt' as const,
      reference: r.referenceNumber ?? r.id.slice(0, 8).toUpperCase(),
      description: r.narration ?? `Payment received — ${r.matter?.matterCode ?? ''}`,
      debitCents: 0,
      creditCents: r.amountCents,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  let balance = 0
  const entries = rows.map(row => {
    balance += row.debitCents - row.creditCents
    return { ...row, balanceCents: balance }
  })

  const totalDebit = entries.reduce((s, e) => s + e.debitCents, 0)
  const totalCredit = entries.reduce((s, e) => s + e.creditCents, 0)

  const office = firmSettings?.offices[0]
  const firmAddress = office
    ? [office.addressLine1, office.city, office.tel ? `Tel: ${office.tel}` : null].filter(Boolean).join(' | ')
    : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(StatementPDF, {
    client,
    entries,
    totals: { debitCents: totalDebit, creditCents: totalCredit, closingBalanceCents: totalDebit - totalCredit },
    firmName: firmSettings?.firmName ?? 'Law Firm',
    firmAddress,
    fromDate: fromParam ?? undefined,
    toDate: toParam ?? undefined,
  }) as any)

  const filename = `Statement-${client.clientCode}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
