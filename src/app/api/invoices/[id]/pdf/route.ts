import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoicePDF } from '@/lib/invoice-pdf'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('invoices/[id]/pdf')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorized - no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  log.debug('GET invoice id:', id)

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!invoice) {
      log.warn('GET invoice not found', { id })
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    log.debug('GET rendering PDF', { invoiceNumber: invoice.invoiceNumber, lineItemCount: invoice.lineItems.length })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(InvoicePDF, { invoice }) as any)

    const isProForma = invoice.invoiceType === 'pro_forma'
    const filename = isProForma
      ? `ProForma-${invoice.invoiceNumber}.pdf`
      : `Invoice-${invoice.invoiceNumber}.pdf`

    log.info('GET completed successfully', { filename, bufferSize: buffer.length })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    log.error('GET failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
