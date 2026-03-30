import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { InvoiceCreateForm } from '@/components/invoices/invoice-create-form'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ matterId?: string; entries?: string }>
}) {
  const session = await getServerSession(authOptions)
  const { matterId, entries } = await searchParams

  if (!matterId) notFound()

  const entryIds = entries ? entries.split(',').filter(Boolean) : []

  // Load matter for display
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      id: true,
      matterCode: true,
      description: true,
      client: { select: { clientName: true } },
    },
  })
  if (!matter) notFound()

  // Non-admin: check access
  if (session?.user?.role !== 'admin') {
    const access = await prisma.matter.findFirst({
      where: {
        id: matterId,
        OR: [
          { ownerId: session!.user.id },
          { matterUsers: { some: { userId: session!.user.id } } },
        ],
      },
      select: { id: true },
    })
    if (!access) notFound()
  }

  // Load selected fee entries
  const feeEntries = await prisma.feeEntry.findMany({
    where: {
      id: entryIds.length > 0 ? { in: entryIds } : undefined,
      matterId,
      isInvoiced: false,
      isBillable: true,
    },
    select: {
      id: true,
      entryType: true,
      entryDate: true,
      narration: true,
      durationMinutesBilled: true,
      unitQuantityThousandths: true,
      rateCents: true,
      totalCents: true,
      feeEarner: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
  })

  const serialisedEntries = feeEntries.map((e) => ({
    ...e,
    entryDate: e.entryDate.toISOString(),
  }))

  return (
    <InvoiceCreateForm
      matter={matter}
      feeEntries={serialisedEntries}
      preselectedIds={entryIds}
    />
  )
}
