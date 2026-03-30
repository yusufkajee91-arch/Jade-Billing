import Link from 'next/link'

export interface WipRow {
  matterId: string
  totalCents: number
  matter: {
    id: string
    matterCode: string
    description: string
    client: { clientName: string }
  }
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function UnbilledWorkWidget({ wip, wipTotal }: { wip: WipRow[]; wipTotal: number }) {
  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
            Unbilled Work
          </p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, lineHeight: 1.2 }}>
            My WIP
          </h2>
        </div>
        {wip.length > 0 && (
          <Link
            href="/reports"
            style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}
            className="hover:underline transition-colors"
          >
            Full report →
          </Link>
        )}
      </div>

      {wip.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#80796F', fontStyle: 'italic' }}>
          No unbilled time entries.
        </p>
      ) : (
        <div>
          {wip.slice(0, 8).map((row, i) => (
            <div key={row.matterId}>
              {i > 0 && <div style={{ height: 1, background: '#D8D3CB' }} />}
              <Link
                href={`/matters/${row.matter.id}`}
                className="flex items-center justify-between py-3 group"
                style={{ transition: 'background 0.15s' }}
              >
                <div
                  className="flex-1 min-w-0 flex items-center gap-4 px-2 -mx-2 rounded-lg group-hover:bg-[rgba(176,139,130,0.07)] transition-colors"
                  style={{ padding: '6px 8px', margin: '0 -8px', borderRadius: 8 }}
                >
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', flexShrink: 0 }}>
                    {row.matter.matterCode}
                  </span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.matter.client.clientName}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#B08B82', flexShrink: 0, marginLeft: 16 }}>
                  {formatAmount(row.totalCents)}
                </span>
              </Link>
            </div>
          ))}

          {/* Total row */}
          <div style={{ height: 1, background: '#B08B82', marginTop: 4 }} />
          <div className="flex items-center justify-between pt-3">
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total unbilled
            </span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#B08B82', fontWeight: 600 }}>
              {formatAmount(wipTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
