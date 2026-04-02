'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRightLeft, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Session } from 'next-auth'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('TrustAccountView')

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatterBalance {
  matterId: string
  matterCode: string
  description: string
  clientName: string
  balanceCents: number
  lastEntryDate: string | null
}

interface TrustRegister {
  matters: MatterBalance[]
  totalBalanceCents: number
}

interface TrustEntry {
  id: string
  matterId: string
  entryType: string
  entryDate: string
  amountCents: number
  narration: string
  referenceNumber: string | null
  chequeNumber: string | null
  supplier: { id: string; name: string } | null
  createdAt: string
}

const INFLOW_TYPES = new Set(['trust_receipt', 'trust_transfer_in', 'collection_receipt'])

const ENTRY_TYPE_LABELS: Record<string, string> = {
  trust_receipt: 'Trust Receipt',
  trust_payment: 'Trust Payment',
  trust_transfer_in: 'Transfer In',
  trust_transfer_out: 'Transfer Out',
  collection_receipt: 'Collection Receipt',
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

// ─── Trust Account View ───────────────────────────────────────────────────────

interface Props {
  session: Session
}

export function TrustAccountView({ session }: Props) {
  log.info('mount', { role: session.user.role })
  const [activeTab, setActiveTab] = useState<'register' | 'journal'>('register')
  const [register, setRegister] = useState<TrustRegister | null>(null)
  const [entries, setEntries] = useState<TrustEntry[]>([])
  const [loadingRegister, setLoadingRegister] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)

  const [showInterTransfer, setShowInterTransfer] = useState(false)
  const [showTrustToBusiness, setShowTrustToBusiness] = useState(false)

  const isAdmin = session.user.role === 'admin'

  const loadRegister = useCallback(async () => {
    log.debug('loading trust register')
    setLoadingRegister(true)
    try {
      const res = await fetch('/api/trust-register')
      if (res.ok) {
        const data = await res.json()
        log.info('trust register loaded', { matterCount: data.matters?.length ?? 0, totalBalanceCents: data.totalBalanceCents })
        setRegister(data)
      } else {
        log.warn('trust register fetch failed', { status: res.status })
      }
    } finally {
      setLoadingRegister(false)
    }
  }, [])

  const loadEntries = useCallback(async () => {
    log.debug('loading trust entries')
    setLoadingEntries(true)
    try {
      const res = await fetch('/api/trust-entries?limit=100')
      if (res.ok) {
        const data = await res.json()
        log.info('trust entries loaded', { count: data.length })
        setEntries(data)
      } else {
        log.warn('trust entries fetch failed', { status: res.status })
      }
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  useEffect(() => {
    loadRegister()
  }, [loadRegister])

  useEffect(() => {
    if (activeTab === 'journal') loadEntries()
  }, [activeTab, loadEntries])

  const tabs = [
    { id: 'register' as const, label: 'Trust Register' },
    { id: 'journal' as const, label: 'Recent Entries' },
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
            Trust Account
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {register && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 2 }}>
                Total Trust Balance
              </p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#F1EDEA', margin: 0 }}>
                {formatCurrency(register.totalBalanceCents)}
              </p>
            </div>
          )}
          <button
            onClick={() => setShowInterTransfer(true)}
            style={{
              fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#ffffff', background: 'rgba(241,237,234,0.18)',
              borderRadius: 40, padding: '10px 22px', border: '1px solid rgba(241,237,234,0.30)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowRightLeft size={14} />
            Inter-Matter Transfer
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowTrustToBusiness(true)}
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
              Transfer to Business
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Transfer forms */}
        {showInterTransfer && (
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            <InterMatterTransferForm
              onSaved={() => { setShowInterTransfer(false); loadRegister(); loadEntries() }}
              onCancel={() => setShowInterTransfer(false)}
            />
          </div>
        )}
        {showTrustToBusiness && (
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            <TrustToBusinessForm
              onSaved={() => { setShowTrustToBusiness(false); loadRegister() }}
              onCancel={() => setShowTrustToBusiness(false)}
            />
          </div>
        )}

        {/* Tab nav */}
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
            {activeTab === 'register' && (
              <TrustRegisterTable register={register} loading={loadingRegister} />
            )}
            {activeTab === 'journal' && (
              <RecentTrustEntries entries={entries} loading={loadingEntries} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Trust Register Table ─────────────────────────────────────────────────────

function TrustRegisterTable({
  register,
  loading,
}: {
  register: TrustRegister | null
  loading: boolean
}) {
  if (loading) {
    return <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', padding: '24px 0' }}>Loading…</p>
  }
  if (!register || register.matters.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>No trust transactions recorded yet.</p>
      </div>
    )
  }

  return (
    <table className="brand-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Matter</th>
          <th>Client</th>
          <th>Last Activity</th>
          <th style={{ textAlign: 'right' }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {register.matters.map((m) => (
          <tr key={m.matterId}>
            <td>
              <Link
                href={`/matters/${m.matterId}?tab=business`}
                style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', textDecoration: 'none' }}
              >
                {m.matterCode}
              </Link>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', marginTop: 2 }}>
                {m.description}
              </p>
            </td>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#4A4845' }}>{m.clientName}</td>
            <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
              {m.lastEntryDate ? formatDate(m.lastEntryDate) : '—'}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: m.balanceCents >= 0 ? '#B08B82' : '#9A3A3A' }}>
              {formatCurrency(m.balanceCents)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F' }}>
            Total — {register.matters.length} matter{register.matters.length === 1 ? '' : 's'}
          </td>
          <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', fontSize: 16, color: register.totalBalanceCents >= 0 ? '#B08B82' : '#9A3A3A', fontWeight: 600 }}>
            {formatCurrency(register.totalBalanceCents)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

// ─── Recent Trust Entries ─────────────────────────────────────────────────────

function RecentTrustEntries({
  entries,
  loading,
}: {
  entries: TrustEntry[]
  loading: boolean
}) {
  if (loading) {
    return <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', padding: '24px 0' }}>Loading…</p>
  }
  if (entries.length === 0) {
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
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const isInflow = INFLOW_TYPES.has(entry.entryType)
          return (
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
                {entry.referenceNumber ?? entry.chequeNumber ?? ''}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
                {isInflow ? formatCurrency(entry.amountCents) : ''}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-serif)', color: '#B08B82' }}>
                {!isInflow ? formatCurrency(entry.amountCents) : ''}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Inter-Matter Transfer Form ───────────────────────────────────────────────

interface TransferFormProps {
  onSaved: () => void
  onCancel: () => void
}

function InterMatterTransferForm({ onSaved, onCancel }: TransferFormProps) {
  const [fromMatterCode, setFromMatterCode] = useState('')
  const [toMatterCode, setToMatterCode] = useState('')
  const [fromMatterId, setFromMatterId] = useState<string | null>(null)
  const [toMatterId, setToMatterId] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saving, setSaving] = useState(false)

  async function lookupMatter(code: string, setter: (id: string | null) => void) {
    if (!code.trim()) { setter(null); return }
    const res = await fetch(`/api/matters?code=${encodeURIComponent(code.trim())}`)
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setter(data[0].id)
      else { setter(null); toast.error(`Matter "${code}" not found`) }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) { toast.error('Enter a valid amount'); return }
    if (!fromMatterId) { toast.error('Enter a valid "From" matter code'); return }
    if (!toMatterId) { toast.error('Enter a valid "To" matter code'); return }
    if (fromMatterId === toMatterId) { toast.error('Cannot transfer to the same matter'); return }

    log.info('inter-matter transfer submitting', { fromMatterId, toMatterId, amountCents })
    setSaving(true)
    try {
      const res = await fetch('/api/trust-entries/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMatterId,
          toMatterId,
          entryDate,
          amountCents,
          narration: narration.trim(),
          referenceNumber: referenceNumber.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        log.error('inter-matter transfer failed', { status: res.status, error: data.error })
        toast.error(data.error ?? 'Transfer failed')
        return
      }
      log.info('inter-matter transfer recorded')
      toast.success('Inter-matter transfer recorded')
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
        Inter-Matter Trust Transfer
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>From Matter Code</label>
          <input
            type="text"
            value={fromMatterCode}
            onChange={(e) => setFromMatterCode(e.target.value)}
            onBlur={() => lookupMatter(fromMatterCode, setFromMatterId)}
            placeholder="e.g. JD/CLI/001"
            required
            style={inputStyle}
          />
          {fromMatterId && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#B08B82', marginTop: 2 }}>Found</p>
          )}
        </div>
        <div>
          <label style={labelStyle}>To Matter Code</label>
          <input
            type="text"
            value={toMatterCode}
            onChange={(e) => setToMatterCode(e.target.value)}
            onBlur={() => lookupMatter(toMatterCode, setToMatterId)}
            placeholder="e.g. JD/CLI/002"
            required
            style={inputStyle}
          />
          {toMatterId && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#B08B82', marginTop: 2 }}>Found</p>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={inputStyle} />
        </div>
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
        <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Transfer of funds between matters" required style={inputStyle} />
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
          {saving ? 'Transferring…' : 'Transfer Funds'}
        </button>
      </div>
    </form>
  )
}

// ─── Trust-to-Business Form ───────────────────────────────────────────────────

function TrustToBusinessForm({ onSaved, onCancel }: TransferFormProps) {
  const [matterCode, setMatterCode] = useState('')
  const [matterId, setMatterId] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saving, setSaving] = useState(false)

  async function lookupMatter() {
    if (!matterCode.trim()) { setMatterId(null); return }
    const res = await fetch(`/api/matters?code=${encodeURIComponent(matterCode.trim())}`)
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setMatterId(data[0].id)
      else { setMatterId(null); toast.error(`Matter "${matterCode}" not found`) }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) { toast.error('Enter a valid amount'); return }
    if (!matterId) { toast.error('Enter a valid matter code'); return }

    log.info('trust-to-business transfer submitting', { matterId, amountCents })
    setSaving(true)
    try {
      const res = await fetch('/api/bookkeeping/trust-to-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          entryDate,
          amountCents,
          narration: narration.trim(),
          referenceNumber: referenceNumber.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        log.error('trust-to-business transfer failed', { status: res.status, error: data.error })
        toast.error(data.error ?? 'Transfer failed')
        return
      }
      log.info('trust-to-business transfer recorded')
      toast.success('Trust-to-business transfer recorded')
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
        Transfer Trust Funds to Business Account
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Matter Code</label>
          <input
            type="text"
            value={matterCode}
            onChange={(e) => setMatterCode(e.target.value)}
            onBlur={lookupMatter}
            placeholder="e.g. JD/CLI/001"
            required
            style={inputStyle}
          />
          {matterId && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#B08B82', marginTop: 2 }}>Found</p>
          )}
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required style={inputStyle} />
        </div>
      </div>
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
        <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Section 78(1) transfer — fees earned" required style={inputStyle} />
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
          {saving ? 'Transferring…' : 'Transfer to Business'}
        </button>
      </div>
    </form>
  )
}
