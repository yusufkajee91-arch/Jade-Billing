import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { InvoicePreview } from '@/components/invoices/invoice-preview'
import { pageLogger } from '@/lib/debug'

const log = pageLogger('invoices/[id]')

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  const { id } = await params
  log.info('Rendering invoice detail page for:', id)

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      matter: { select: { id: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  })

  if (!invoice) {
    log.warn('Invoice not found:', id)
    notFound()
  }
  log.debug('Invoice loaded:', { invoiceNumber: invoice.invoiceNumber, status: invoice.status })

  // Non-admin: ensure the user has access to this matter
  if (session?.user?.role !== 'admin') {
    const access = await prisma.matter.findFirst({
      where: {
        id: invoice.matter.id,
        OR: [
          { ownerId: session!.user.id },
          { matterUsers: { some: { userId: session!.user.id } } },
        ],
      },
      select: { id: true },
    })
    if (!access) notFound()
  }

  // Serialise dates to strings for the client component
  const serialised = {
    ...invoice,
    invoiceDate: invoice.invoiceDate.toISOString(),
    sentAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    lineItems: invoice.lineItems.map((li) => ({
      ...li,
      entryDate: li.entryDate.toISOString(),
    })),
  }

  return <InvoicePreview invoice={serialised} />
}
