import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoicePDF } from '@/lib/invoice-pdf'

export async function GET(
  _request: NextRequest,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(InvoicePDF, { invoice }) as any)

  const isProForma = invoice.invoiceType === 'pro_forma'
  const filename = isProForma
    ? `ProForma-${invoice.invoiceNumber}.pdf`
    : `Invoice-${invoice.invoiceNumber}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
