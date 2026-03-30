'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRight, Check, Clock, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingStatus = 'not_yet_billed' | 'awaiting_payment' | 'paid'

interface PracticeMatter {
  id: string
  matterCode: string
  description: string
  status: string
  dateOpened: string
  billingStatus: BillingStatus
  loeFicaDone: boolean
  matterStatusNote: string | null
  allocation: string | null
  comment: string | null
  client: { id: string; clientCode: string; clientName: string }
  owner: { id: string; firstName: string; lastName: string; initials: string }
  _count?: { feeEntries: number }
}

const BILLING_LABELS: Record<BillingStatus, string> = {
  not_yet_billed: 'Not Billed',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
}

const BILLING_COLORS: Record<BillingStatus, string> = {
  not_yet_billed: '#80796F',
  awaiting_payment: '#f59e0b',
  paid: '#22c55e',
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
  overflow: 'hidden',
}

// ─── Inline editable text cell ────────────────────────────────────────────────

function InlineCell({
  value,
  matterId,
  field,
  placeholder,
  multiline,
}: {
  value: string | null
  matterId: string
  field: string
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  const save = useCallback(async () => {
    const next = current.trim() || null
    if (next === (value ?? null)) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/matters/${matterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    })
    setSaving(false)
    if (res.ok) { setEditing(false) }
    else { toast.error('Failed to save'); setCurrent(value ?? '') }
  }, [current, matterId, field, value])

  if (editing) {
    const sharedProps = {
      ref: ref as React.Ref<HTMLTextAreaElement & HTMLInputElement>,
      value: current,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCurrent(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setCurrent(value ?? ''); setEditing(false) }
        if (!multiline && e.key === 'Enter') { e.preventDefault(); save() }
      },
      style: {
        width: '100%',
        minWidth: 120,
        padding: '4px 6px',
        border: '1px solid #B08B82',
        borderRadius: 6,
        fontFamily: 'var(--font-noto-sans)',
        fontSize: 12,
        color: '#2C2C2A',
        background: 'rgba(255,252,250,0.9)',
        outline: 'none',
        resize: 'vertical' as const,
      },
    }
    return multiline
      ? <textarea {...sharedProps} rows={2} />
      : <input type="text" {...sharedProps} />
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        fontFamily: 'var(--font-noto-sans)',
        fontSize: 12,
        color: current ? '#2C2C2A' : '#C0BAB0',
        cursor: 'text',
        display: 'block',
        minWidth: 60,
        padding: '2px 0',
        opacity: saving ? 0.5 : 1,
      }}
      title="Click to edit"
    >
      {current || placeholder || '—'}
    </span>
  )
}

// ─── Billing status cell ──────────────────────────────────────────────────────

function BillingStatusCell({ value, matterId }: { value: BillingStatus; matterId: string }) {
  const [current, setCurrent] = useState(value)
  const [saving, setSaving] = useState(false)

  const onChange = useCallback(async (next: BillingStatus) => {
    setSaving(true)
    setCurrent(next)
    const res = await fetch(`/api/matters/${matterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingStatus: next }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Failed to save'); setCurrent(value) }
  }, [matterId, value])

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as BillingStatus)}
      disabled={saving}
      style={{
        fontFamily: 'var(--font-noto-sans)',
        fontSize: 11,
        color: BILLING_COLORS[current],
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
        opacity: saving ? 0.5 : 1,
      }}
    >
      {(Object.keys(BILLING_LABELS) as BillingStatus[]).map((k) => (
        <option key={k} value={k}>{BILLING_LABELS[k]}</option>
      ))}
    </select>
  )
}

// ─── LOE / FICA checkbox cell ─────────────────────────────────────────────────

function LoeFicaCell({ value, matterId }: { value: boolean; matterId: string }) {
  const [current, setCurrent] = useState(value)

  const toggle = useCallback(async () => {
    const next = !current
    setCurrent(next)
    const res = await fetch(`/api/matters/${matterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loeFicaDone: next }),
    })
    if (!res.ok) { toast.error('Failed to save'); setCurrent(current) }
  }, [current, matterId])

  return (
    <button
      onClick={toggle}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
      title={current ? 'LOE/FICA done' : 'LOE/FICA not done'}
    >
      {current
        ? <Check style={{ width: 14, height: 14, color: '#4A7C59' }} />
        : <X style={{ width: 14, height: 14, color: '#C0BAB0' }} />
      }
    </button>
  )
}

// ─── Main PracticeOverview ────────────────────────────────────────────────────

export function PracticeOverview() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [matters, setMatters] = useState<PracticeMatter[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'open' | 'closed' | 'all'>('open')
  const [filterBilling, setFilterBilling] = useState<BillingStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  const load = useCallback(async () => {
    if (authStatus !== 'authenticated') return
    setLoading(true)
    const p = new URLSearchParams()
    if (filterStatus !== 'all') p.set('status', filterStatus)
    // For non-admins, filter to owned/accessed matters
    const res = await fetch(`/api/matters?${p}&limit=500`)
    if (res.ok) setMatters(await res.json())
    setLoading(false)
  }, [authStatus, filterStatus])

  useEffect(() => { load() }, [load])

  const filtered = matters.filter((m) => {
    if (filterBilling !== 'all' && m.billingStatus !== filterBilling) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !m.matterCode.toLowerCase().includes(q) &&
        !m.description.toLowerCase().includes(q) &&
        !m.client.clientName.toLowerCase().includes(q) &&
        !m.owner.initials.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const isAdmin = session?.user.role === 'admin'

  const inputCls: React.CSSProperties = {
    height: 32,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #D8D3CB',
    background: 'rgba(241,237,234,0.6)',
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 12,
    color: '#2C2C2A',
    outline: 'none',
  }

  const thStyle: React.CSSProperties = {
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#80796F',
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 500,
    borderBottom: '1px solid rgba(216,211,203,0.6)',
    background: 'rgba(241,237,234,0.3)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(216,211,203,0.3)',
    verticalAlign: 'top',
  }

  return (
    <div style={{ width: '100%', paddingTop: 16 }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>Practice</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>Practice Overview</h1>
        </div>
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: 'rgba(241,237,234,0.55)' }}>
          {loading ? '…' : `${filtered.length} matter${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filters */}
      <div className="fade-up" style={{ animationDelay: '60ms', display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search matters…"
          style={{ ...inputCls, minWidth: 200 }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} style={{ ...inputCls, width: 'auto' }}>
          <option value="open">Open Matters</option>
          <option value="closed">Closed Matters</option>
          <option value="all">All Statuses</option>
        </select>
        <select value={filterBilling} onChange={(e) => setFilterBilling(e.target.value as typeof filterBilling)} style={{ ...inputCls, width: 'auto' }}>
          <option value="all">All Billing Status</option>
          <option value="not_yet_billed">Not Yet Billed</option>
          <option value="awaiting_payment">Awaiting Payment</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="fade-up" style={{ animationDelay: '120ms', ...GLASS }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Matter</th>
                <th style={thStyle}>Client</th>
                {isAdmin && <th style={thStyle}>Owner</th>}
                <th style={thStyle}>Status Note</th>
                <th style={thStyle}>Allocation</th>
                <th style={thStyle}>Comment</th>
                <th style={thStyle}>Billing</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>LOE/FICA</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ ...tdStyle, textAlign: 'center', color: '#80796F', fontFamily: 'var(--font-noto-sans)', fontSize: 13 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ ...tdStyle, textAlign: 'center', color: '#80796F', fontFamily: 'var(--font-noto-sans)', fontSize: 13, padding: '32px 16px' }}>
                    No matters found.
                  </td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} style={{ background: 'transparent' }}>
                  <td style={tdStyle}>
                    <div>
                      <Link
                        href={`/matters/${m.id}`}
                        style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82', fontWeight: 600, textDecoration: 'none', letterSpacing: '0.04em' }}
                      >
                        {m.matterCode}
                      </Link>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#5C5852', marginTop: 2 }}>{m.description}</p>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#2C2C2A' }}>{m.client.clientName}</p>
                    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F' }}>{m.client.clientCode}</p>
                  </td>
                  {isAdmin && (
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>{m.owner.initials}</span>
                    </td>
                  )}
                  <td style={{ ...tdStyle, minWidth: 140, maxWidth: 200 }}>
                    <InlineCell value={m.matterStatusNote} matterId={m.id} field="matterStatusNote" placeholder="Add note…" multiline />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 100, maxWidth: 150 }}>
                    <InlineCell value={m.allocation} matterId={m.id} field="allocation" placeholder="Allocate…" />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 140, maxWidth: 200 }}>
                    <InlineCell value={m.comment} matterId={m.id} field="comment" placeholder="Comment…" multiline />
                  </td>
                  <td style={tdStyle}>
                    <BillingStatusCell value={m.billingStatus ?? 'not_yet_billed'} matterId={m.id} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <LoeFicaCell value={m.loeFicaDone ?? false} matterId={m.id} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <Link href={`/matters/${m.id}`} title="Open matter" style={{ color: '#80796F', display: 'inline-flex' }}>
                      <ArrowUpRight style={{ width: 14, height: 14 }} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
