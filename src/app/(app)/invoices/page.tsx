import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileText } from 'lucide-react'
import { InvoiceListTable } from './invoice-list-table'

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  const where: Record<string, unknown> = {}
  if (!isAdmin) {
    where.matter = {
      OR: [
        { ownerId: session!.user.id },
        { matterUsers: { some: { userId: session!.user.id } } },
      ],
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      status: true,
      invoiceDate: true,
      clientName: true,
      matterCode: true,
      matterDescription: true,
      subTotalCents: true,
      vatCents: true,
      totalCents: true,
      sentAt: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Serialize dates for client component
  const rows = invoices.map((inv) => ({
    ...inv,
    invoiceDate: inv.invoiceDate instanceof Date ? inv.invoiceDate.toISOString() : String(inv.invoiceDate),
    sentAt: inv.sentAt instanceof Date ? inv.sentAt.toISOString() : inv.sentAt ? String(inv.sentAt) : null,
    paidAt: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : inv.paidAt ? String(inv.paidAt) : null,
  }))

  const draftCount = invoices.filter((i) => i.status === 'draft_pro_forma' || i.status === 'draft_invoice').length

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* ─── Dark header bar ─────────────────────────────────────────────────── */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Billing
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Invoices
            {draftCount > 0 && (
              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)', fontWeight: 400, marginLeft: 16 }}>
                {draftCount} unsent
              </span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: 'rgba(241,237,234,0.55)' }}>
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>
      </div>

      {/* ─── Table or empty state ─────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, padding: 64, textAlign: 'center' }}>
          <FileText style={{ width: 40, height: 40, color: '#B08B82', margin: '0 auto 16px' }} strokeWidth={1.5} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>
            No invoices yet.
          </p>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', marginTop: 8 }}>
            Select unbilled entries on a matter to create one.
          </p>
        </div>
      ) : (
        <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, overflow: 'hidden' }}>
          <InvoiceListTable invoices={rows} />
        </div>
      )}
    </div>
  )
}
