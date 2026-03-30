'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Session } from 'next-auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  name: string
}

interface BusinessEntry {
  id: string
  matterId: string | null
  entryType: string
  entryDate: string
  amountCents: number
  narration: string
  referenceNumber: string | null
  supplier: Supplier | null
  createdAt: string
}

interface TrialBalanceRow {
  id: string
  code: string
  name: string
  accountType: string
  totalDebitCents: number
  totalCreditCents: number
  balanceCents: number
}

interface TrialBalance {
  rows: TrialBalanceRow[]
  grandTotalDebitCents: number
  grandTotalCreditCents: number
}

const INFLOW_TYPES = new Set(['matter_receipt', 'business_receipt', 'trust_to_business'])

const ENTRY_TYPE_LABELS: Record<string, string> = {
  matter_receipt: 'Matter Receipt',
  matter_payment: 'Matter Payment',
  business_receipt: 'Business Receipt',
  business_payment: 'Business Payment',
  supplier_invoice: 'Supplier Invoice',
  supplier_payment: 'Supplier Payment',
  bank_transfer: 'Bank Transfer',
  trust_to_business: 'Trust → Business',
}

const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
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

// ─── Main View ────────────────────────────────────────────────────────────────

interface Props {
  session: Session
}

export function BusinessAccountView({ session }: Props) {
  const [activeTab, setActiveTab] = useState<'journal' | 'trial-balance'>('journal')
  const [entries, setEntries] = useState<BusinessEntry[]>([])
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [loadingTb, setLoadingTb] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const res = await fetch('/api/business-entries?limit=100')
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  const loadTrialBalance = useCallback(async () => {
    setLoadingTb(true)
    try {
      const res = await fetch('/api/gl/trial-balance')
      if (res.ok) setTrialBalance(await res.json())
    } finally {
      setLoadingTb(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
    fetch('/api/suppliers?active=true')
      .then((r) => r.json())
      .then(setSuppliers)
      .catch(() => {})
  }, [loadEntries])

  useEffect(() => {
    if (activeTab === 'trial-balance') loadTrialBalance()
  }, [activeTab, loadTrialBalance])

  // Compute running balance for journal display
  const rows = entries.map((entry, i) => {
    const prevBalance = entries
      .slice(0, i)
      .reduce((sum, e) => sum + (INFLOW_TYPES.has(e.entryType) ? e.amountCents : -e.amountCents), 0)
    const isInflow = INFLOW_TYPES.has(entry.entryType)
    const balance = prevBalance + (isInflow ? entry.amountCents : -entry.amountCents)
    return { entry, isInflow, balance }
  })

  const totalBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0

  const tabs = [
    { id: 'journal' as const, label: 'Business Journal' },
    { id: 'trial-balance' as const, label: 'Trial Balance' },
  ]

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Accounts
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Business Account
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 2 }}>
              Net Position
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#F1EDEA', margin: 0 }}>
              {formatCurrency(totalBalance)}
            </p>
          </div>
          {(session.user.role === 'admin' || session.user.role === 'fee_earner') && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#ffffff', background: '#B08B82',
                borderRadius: 40, padding: '10px 22px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
            >
              <PlusCircle size={14} />
              Add Entry
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* New entry form */}
        {showForm && (
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            <FirmBusinessEntryForm
              suppliers={suppliers}
              onSaved={() => { setShowForm(false); loadEntries(); if (activeTab === 'trial-balance') loadTrialBalance() }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Tabs + ledger */}
        <div className="fade-up" style={{ animationDelay: '80ms' }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(74,72,69,0.12)', marginBottom: 20 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 16px',
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderBottom: activeTab === t.id ? '2px solid #B08B82' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeTab === t.id ? '#2C2C2A' : '#80796F',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={GLASS}>
            {activeTab === 'journal' && (
              <BusinessJournalTable rows={rows} loading={loadingEntries} />
            )}
            {activeTab === 'trial-balance' && (
              <TrialBalanceTable trialBalance={trialBalance} loading={loadingTb} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Business Journal Table ───────────────────────────────────────────────────

function BusinessJournalTable({
  rows,
  loading,
}: {
  rows: { entry: BusinessEntry; isInflow: boolean; balance: number }[]
  loading: boolean
}) {
  if (loading) {
    return <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', padding: '24px 0' }}>Loading…</p>
  }
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>No entries found.</p>
      </div>
    )
  }

  return (
    <table className="brand-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Narration</th>
          <th>Ref</th>
          <th style={{ textAlign: 'right' }}>Receipts</th>
          <th style={{ textAlign: 'right' }}>Payments</th>
          <th style={{ textAlign: 'right' }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ entry, isInflow, balance }) => (
          <tr key={entry.id}>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', whiteSpace: 'nowrap' }}>
              {formatDate(entry.entryDate)}
            </td>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', whiteSpace: 'nowrap' }}>
              {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
            </td>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>
              {entry.narration}
              {entry.supplier && (
                <span style={{ color: '#80796F', marginLeft: 6 }}>— {entry.supplier.name}</span>
              )}
            </td>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
              {entry.referenceNumber ?? ''}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
              {isInflow ? formatCurrency(entry.amountCents) : ''}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
              {!isInflow ? formatCurrency(entry.amountCents) : ''}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: balance >= 0 ? '#B08B82' : '#9A3A3A' }}>
              {formatCurrency(balance)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Trial Balance Table ──────────────────────────────────────────────────────

function TrialBalanceTable({
  trialBalance,
  loading,
}: {
  trialBalance: TrialBalance | null
  loading: boolean
}) {
  if (loading) {
    return <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', padding: '24px 0' }}>Loading…</p>
  }
  if (!trialBalance) return null

  const isBalanced = trialBalance.grandTotalDebitCents === trialBalance.grandTotalCreditCents

  // Group by account type
  const grouped = ACCOUNT_TYPE_ORDER.reduce<Record<string, TrialBalanceRow[]>>((acc, type) => {
    acc[type] = trialBalance.rows.filter((r) => r.accountType === type)
    return acc
  }, {})

  return (
    <table className="brand-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Code</th>
          <th>Account</th>
          <th style={{ textAlign: 'right' }}>Debits</th>
          <th style={{ textAlign: 'right' }}>Credits</th>
          <th style={{ textAlign: 'right' }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {ACCOUNT_TYPE_ORDER.map((type) => {
          const accts = grouped[type] ?? []
          if (accts.length === 0) return null
          return (
            <>
              <tr key={`group-${type}`}>
                <td
                  colSpan={5}
                  style={{
                    fontFamily: 'var(--font-noto-sans)',
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: '#80796F',
                    background: 'rgba(74,72,69,0.04)',
                    padding: '6px 12px',
                  }}
                >
                  {ACCOUNT_TYPE_LABELS[type]}
                </td>
              </tr>
              {accts.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>{row.code}</td>
                  <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{row.name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
                    {row.totalDebitCents > 0 ? formatCurrency(row.totalDebitCents) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
                    {row.totalCreditCents > 0 ? formatCurrency(row.totalCreditCents) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82', fontWeight: 600 }}>
                    {row.balanceCents !== 0 ? formatCurrency(row.balanceCents) : '—'}
                  </td>
                </tr>
              ))}
            </>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>
            Totals
          </td>
          <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82', fontWeight: 700 }}>
            {formatCurrency(trialBalance.grandTotalDebitCents)}
          </td>
          <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82', fontWeight: 700 }}>
            {formatCurrency(trialBalance.grandTotalCreditCents)}
          </td>
          <td style={{ textAlign: 'right' }}>
            <span
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 20,
                fontWeight: 500,
                backgroundColor: isBalanced ? 'hsl(145 40% 92%)' : 'hsl(0 40% 92%)',
                color: isBalanced ? 'hsl(145 50% 35%)' : 'hsl(0 60% 40%)',
              }}
            >
              {isBalanced ? 'Balanced' : 'Out of Balance'}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

// ─── Firm-level Business Entry Form ──────────────────────────────────────────

interface FirmFormProps {
  suppliers: Supplier[]
  onSaved: () => void
  onCancel: () => void
}

function FirmBusinessEntryForm({ suppliers, onSaved, onCancel }: FirmFormProps) {
  const [entryType, setEntryType] = useState('business_receipt')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [saving, setSaving] = useState(false)

  const needsSupplier = entryType === 'supplier_invoice' || entryType === 'supplier_payment'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/business-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: null,
          entryType,
          entryDate,
          amountCents,
          narration: narration.trim(),
          referenceNumber: referenceNumber.trim() || null,
          supplierId: supplierId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to save entry')
        return
      }
      toast.success('Business entry recorded')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    border: '1px solid rgba(74,72,69,0.20)',
    background: 'rgba(255,255,255,0.80)',
    padding: '8px 12px',
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 13,
    color: '#2C2C2A',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#80796F',
    display: 'block',
    marginBottom: 4,
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...GLASS }}>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#B08B82', marginBottom: 16 }}>
        New Business Entry (Firm-Level)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={entryType} onChange={(e) => setEntryType(e.target.value)} style={inputStyle}>
            <option value="business_receipt">Business Receipt</option>
            <option value="business_payment">Business Payment</option>
            <option value="supplier_invoice">Supplier Invoice</option>
            <option value="supplier_payment">Supplier Payment</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={inputStyle} />
        </div>
      </div>

      {needsSupplier && suppliers.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={inputStyle}>
            <option value="">— Select Supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Amount (R)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Reference</label>
          <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Optional" style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Narration</label>
        <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Monthly bank charges" required style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="font-sans text-xs tracking-wide uppercase">
          Cancel
        </Button>
        <button
          type="submit"
          disabled={saving}
          style={{
            fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#ffffff', background: '#B08B82',
            borderRadius: 40, padding: '10px 22px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#93706A' }}
          onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#B08B82' }}
        >
          {saving ? 'Saving…' : 'Save Entry'}
        </button>
      </div>
    </form>
  )
}
