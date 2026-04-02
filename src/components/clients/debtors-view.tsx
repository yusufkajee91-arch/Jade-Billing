'use client'

import { useState, useEffect, Fragment } from 'react'
import { ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('DebtorsView')

interface DebtorInvoice {
  id: string
  invoiceNumber: string
  matterCode: string
  invoiceDate: string
  totalCents: number
  ageDays: number
}

interface Debtor {
  clientId: string
  clientName: string
  currentCents: number
  thirtyCents: number
  sixtyCents: number
  ninetyCents: number
  totalCents: number
  invoices: DebtorInvoice[]
}

// ─── Design constants ─────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

function AgeCell({ cents, color }: { cents: number; color: string }) {
  if (cents === 0) return (
    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>—</td>
  )
  return (
    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 600, color }}>
      {formatCurrency(cents)}
    </td>
  )
}

export function DebtorsView() {
  log.info('mount')
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    log.debug('loading debtors data')
    fetch('/api/debtors')
      .then(r => r.json())
      .then(data => {
        log.info('debtors loaded', { debtorCount: data.debtors?.length ?? 0, grandTotal: data.grandTotal ?? 0 })
        setDebtors(data.debtors ?? [])
        setGrandTotal(data.grandTotal ?? 0)
      })
      .catch(err => {
        log.error('debtors loading failed', err)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = (clientId: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Billing
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Debtors
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 2 }}>
            Total Outstanding
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#F1EDEA', margin: 0 }}>
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Summary stats */}
        <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', gap: 16 }}>
          <div style={{ ...GLASS, flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 8 }}>
              Total Outstanding
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#B08B82', margin: 0 }}>
              {formatCurrency(grandTotal)}
            </p>
          </div>
          <div style={{ ...GLASS, flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 8 }}>
              Debtors
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#2C2C2A', margin: 0 }}>
              {debtors.length}
            </p>
          </div>
        </div>

        {/* Age analysis table */}
        {loading ? (
          <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', textAlign: 'center', padding: '48px 0' }}>Loading…</p>
          </div>
        ) : debtors.length === 0 ? (
          <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS }}>
            <div style={{ textAlign: 'center', padding: '64px 24px' }}>
              <Receipt style={{ width: 32, height: 32, color: '#80796F', opacity: 0.4, margin: '0 auto 12px' }} />
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>No outstanding invoices — all clients are up to date.</p>
            </div>
          </div>
        ) : (
          <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS, padding: 0, overflow: 'hidden' }}>
            <table className="brand-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Current (0–30)</th>
                  <th style={{ textAlign: 'right' }}>31–60 days</th>
                  <th style={{ textAlign: 'right' }}>61–90 days</th>
                  <th style={{ textAlign: 'right' }}>91+ days</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map(debtor => {
                  const open = expanded.has(debtor.clientId)
                  return (
                    <Fragment key={debtor.clientId}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggle(debtor.clientId)}
                      >
                        <td style={{ padding: '12px 16px', color: '#80796F' }}>
                          {open
                            ? <ChevronDown style={{ width: 14, height: 14 }} />
                            : <ChevronRight style={{ width: 14, height: 14 }} />}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, fontWeight: 500, color: '#2C2C2A' }}>
                          {debtor.clientName}
                        </td>
                        <AgeCell cents={debtor.currentCents} color="#22c55e" />
                        <AgeCell cents={debtor.thirtyCents} color="#f59e0b" />
                        <AgeCell cents={debtor.sixtyCents} color="#f97316" />
                        <AgeCell cents={debtor.ninetyCents} color="#ef4444" />
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: '#B08B82' }}>
                          {formatCurrency(debtor.totalCents)}
                        </td>
                      </tr>

                      {open && debtor.invoices.map(inv => (
                        <tr key={inv.id} style={{ background: 'rgba(74,72,69,0.03)' }}>
                          <td style={{ padding: '8px 16px' }} />
                          <td style={{ padding: '8px 16px 8px 40px' }}>
                            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>{inv.invoiceNumber}</span>
                            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginLeft: 8 }}>— {inv.matterCode}</span>
                            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginLeft: 8 }}>
                              {formatDate(inv.invoiceDate)} ({inv.ageDays}d)
                            </span>
                          </td>
                          <td colSpan={4} />
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 13, color: '#B08B82' }}>
                            {formatCurrency(inv.totalCents)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}

                {/* Grand total row */}
                <tr style={{ borderTop: '2px solid rgba(74,72,69,0.12)', background: 'rgba(74,72,69,0.04)' }}>
                  <td style={{ padding: '12px 16px' }} />
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', fontWeight: 600 }}>
                    Total
                  </td>
                  <td colSpan={4} />
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: '#B08B82' }}>
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
