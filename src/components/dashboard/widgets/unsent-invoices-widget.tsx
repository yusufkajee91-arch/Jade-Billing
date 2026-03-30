import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export interface UnsentInvoice {
  id: string
  invoiceNumber: string
  clientName: string
  matterCode: string
  totalCents: number
  createdAt: string
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function UnsentInvoicesWidget({ invoices }: { invoices: UnsentInvoice[] }) {
  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
        Awaiting Sending
      </p>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, marginBottom: 20, lineHeight: 1.2 }}>
        My Unsent Invoices
      </h2>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <CheckCircle2 style={{ width: 32, height: 32, color: '#6B7D6A' }} strokeWidth={1.5} />
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#80796F', fontStyle: 'italic' }}>
            All invoices sent — you&apos;re up to date.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 group transition-colors"
              style={{ background: 'rgba(74, 72, 69, 0.04)', borderRadius: 12 }}
            >
              <div className="min-w-0">
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.clientName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>
                    {inv.matterCode}
                  </span>
                  <span style={{ color: '#D8D3CB', fontSize: 10 }}>·</span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>
                    {inv.invoiceNumber}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#B08B82' }}>
                    {formatAmount(inv.totalCents)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>
                    {formatDate(inv.createdAt)}
                  </p>
                </div>
                <ArrowRight style={{ width: 14, height: 14, color: '#B08B82' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
