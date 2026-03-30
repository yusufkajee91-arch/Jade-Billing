'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

function ageBadgeStyle(days: number): React.CSSProperties {
  if (days > 90) return { background: 'rgba(192,87,74,0.12)', color: '#C0574A', border: '1px solid rgba(192,87,74,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-noto-sans)' }
  if (days > 60) return { background: 'rgba(176,139,130,0.12)', color: '#B08B82', border: '1px solid rgba(176,139,130,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-noto-sans)' }
  if (days > 30) return { background: 'rgba(200,175,120,0.15)', color: '#80796F', border: '1px solid rgba(200,175,120,0.3)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-noto-sans)' }
  return { background: 'rgba(107,125,106,0.10)', color: '#6B7D6A', border: '1px solid rgba(107,125,106,0.2)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-noto-sans)' }
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CollectionsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/debtors')
      if (res.ok) {
        const data = await res.json()
        setDebtors(data.debtors ?? [])
        setGrandTotal(data.grandTotal ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const overdue90 = debtors.filter((d) => d.ninetyCents > 0).length

  const toggleExpand = (clientId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Accounts
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Collections
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {overdue90 > 0 && (
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#C0574A' }}>
              {overdue90} {overdue90 === 1 ? 'client' : 'clients'} 90+ days overdue
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#F1EDEA' }}>
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* KPI row */}
      {!loading && debtors.length > 0 && (
        <div className="fade-up" style={{ animationDelay: '40ms', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: '0–30 days', value: debtors.reduce((s, d) => s + d.currentCents, 0), color: '#6B7D6A' },
            { label: '31–60 days', value: debtors.reduce((s, d) => s + d.thirtyCents, 0), color: '#80796F' },
            { label: '61–90 days', value: debtors.reduce((s, d) => s + d.sixtyCents, 0), color: '#B08B82' },
            { label: '90+ days', value: debtors.reduce((s, d) => s + d.ninetyCents, 0), color: '#C0574A' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...GLASS, padding: 16 }}>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 4 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color }}>{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brand-table">
            <thead>
              <tr>
                <th style={{ width: '30%', padding: '12px 16px' }}>Client</th>
                <th style={{ width: '15%', textAlign: 'right', padding: '12px 16px' }}>0–30 days</th>
                <th style={{ width: '15%', textAlign: 'right', padding: '12px 16px' }}>31–60 days</th>
                <th style={{ width: '15%', textAlign: 'right', padding: '12px 16px' }}>61–90 days</th>
                <th style={{ width: '15%', textAlign: 'right', padding: '12px 16px' }}>90+ days</th>
                <th style={{ width: '10%', textAlign: 'right', padding: '12px 16px' }}>Total Outstanding</th>
                <th style={{ width: '5%', padding: '12px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7}>
                      <div style={{ height: 16, background: 'rgba(216,211,203,0.4)', borderRadius: 4 }} className="animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : debtors.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 56 }}>
                    <CreditCard style={{ width: 36, height: 36, color: '#B08B82', margin: '0 auto 12px' }} strokeWidth={1.5} />
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#80796F', fontStyle: 'italic' }}>
                      No outstanding invoices.
                    </p>
                  </td>
                </tr>
              ) : (
                debtors.map((debtor) => (
                  <React.Fragment key={debtor.clientId}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleExpand(debtor.clientId)}
                    >
                      <td>
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', fontWeight: 500 }}>
                          {debtor.clientName}
                        </span>
                        <span style={{ marginLeft: 8, fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F' }}>
                          {debtor.invoices.length} {debtor.invoices.length === 1 ? 'invoice' : 'invoices'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, color: debtor.currentCents > 0 ? '#6B7D6A' : '#80796F' }}>
                        {debtor.currentCents > 0 ? formatCurrency(debtor.currentCents) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, color: debtor.thirtyCents > 0 ? '#80796F' : '#80796F' }}>
                        {debtor.thirtyCents > 0 ? formatCurrency(debtor.thirtyCents) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, color: debtor.sixtyCents > 0 ? '#B08B82' : '#80796F' }}>
                        {debtor.sixtyCents > 0 ? formatCurrency(debtor.sixtyCents) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, color: debtor.ninetyCents > 0 ? '#C0574A' : '#80796F' }}>
                        {debtor.ninetyCents > 0 ? formatCurrency(debtor.ninetyCents) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 15, color: '#B08B82', fontWeight: 400 }}>
                        {formatCurrency(debtor.totalCents)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F' }}>
                        {expanded.has(debtor.clientId) ? '▲' : '▼'}
                      </td>
                    </tr>
                    {expanded.has(debtor.clientId) && debtor.invoices.map((inv) => (
                      <tr key={inv.id} style={{ background: 'rgba(241,237,234,0.4)' }}>
                        <td style={{ paddingLeft: 40 }}>
                          <Link href={`/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82' }}>{inv.invoiceNumber}</span>
                            <span style={{ marginLeft: 10, fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>{inv.matterCode}</span>
                          </Link>
                        </td>
                        <td colSpan={4}>
                          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                            {fmtDate(inv.invoiceDate)}
                          </span>
                          <span style={{ marginLeft: 12, ...ageBadgeStyle(inv.ageDays) }}>
                            {inv.ageDays} days
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 14, color: '#3E3B36' }}>
                          {formatCurrency(inv.totalCents)}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
