import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoicePDF } from '@/lib/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/email'
import { formatCurrency } from '@/lib/utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  if (invoice.status !== 'draft_pro_forma' && invoice.status !== 'draft_invoice') {
    return NextResponse.json({ error: 'Only draft invoices can be sent' }, { status: 409 })
  }

  // Optional override recipient from request body
  const body = await request.json().catch(() => ({}))
  const toEmail: string = body.toEmail || invoice.clientEmail || ''

  if (!toEmail) {
    return NextResponse.json(
      { error: 'No email address — set an invoice email on the client or provide toEmail in the request' },
      { status: 422 },
    )
  }

  // Load SMTP settings
  const firm = await prisma.firmSettings.findFirst({
    select: {
      smtpHost: true, smtpPort: true, smtpUser: true,
      smtpPassword: true, smtpFromEmail: true, smtpFromName: true,
      firmName: true,
    },
  })

  if (!firm?.smtpHost || !firm.smtpUser || !firm.smtpPassword || !firm.smtpFromEmail) {
    return NextResponse.json(
      { error: 'SMTP is not configured — add mail settings in Settings → Firm' },
      { status: 422 },
    )
  }

  // Generate PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(createElement(InvoicePDF, { invoice }) as any)

  await sendInvoiceEmail({
    smtp: {
      host: firm.smtpHost,
      port: firm.smtpPort,
      user: firm.smtpUser,
      password: firm.smtpPassword,
      fromEmail: firm.smtpFromEmail,
      fromName: firm.smtpFromName || firm.firmName,
    },
    to: toEmail,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    matterCode: invoice.matterCode,
    totalFormatted: formatCurrency(invoice.totalCents),
    isProForma: invoice.invoiceType === 'pro_forma',
    pdfBuffer: Buffer.from(pdfBuffer),
  })

  // Advance status
  const newStatus = invoice.status === 'draft_pro_forma' ? 'sent_pro_forma' : 'sent_invoice'
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: newStatus, sentAt: new Date() },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json(updated)
}
