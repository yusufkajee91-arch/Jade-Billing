'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { Session } from 'next-auth'

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

// Entry types that increase the business balance (credits)
const INFLOW_TYPES = new Set([
  'matter_receipt',
  'business_receipt',
  'trust_to_business',
])

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Props {
  matterId: string
  session: Session
}

export function BusinessLedger({ matterId, session }: Props) {
  const [entries, setEntries] = useState<BusinessEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/business-entries?matterId=${matterId}`)
      if (!res.ok) throw new Error('Failed to load business entries')
      setEntries(await res.json())
    } catch {
      toast.error('Could not load business ledger')
    } finally {
      setLoading(false)
    }
  }, [matterId])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const rows = entries.map((entry, i) => {
    const prevBalance = i === 0
      ? 0
      : entries.slice(0, i).reduce((sum, e) => {
          return sum + (INFLOW_TYPES.has(e.entryType) ? e.amountCents : -e.amountCents)
        }, 0)
    const isInflow = INFLOW_TYPES.has(entry.entryType)
    const balance = prevBalance + (isInflow ? entry.amountCents : -entry.amountCents)
    return { entry, isInflow, balance }
  })

  const totalBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0
  const canDelete = session.user.role === 'admin'

  async function deleteEntry(id: string) {
    if (!confirm('Delete this business entry? This cannot be undone.')) return
    const res = await fetch(`/api/business-entries/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to delete entry')
      return
    }
    toast.success('Entry deleted')
    fetchEntries()
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#B08B82' }} />
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
            Business Account
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-sans text-sm font-medium"
            style={{ color: totalBalance >= 0 ? '#B08B82' : '#9A3A3A' }}
          >
            Balance: {formatCurrency(totalBalance)}
          </span>
          {(session.user.role === 'admin' || session.user.role === 'fee_earner') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="font-sans text-xs tracking-wide uppercase border-[#B08B82] text-[#B08B82] hover:bg-[hsl(10_50%_97%)]"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-muted-foreground italic py-4">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground italic py-4">
          No business transactions yet.
        </p>
      ) : (
        <div className="rounded-md border border-[hsl(10_32%_85%)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: 'hsl(10 50% 97%)' }}>
                <th className="px-3 py-2 text-left font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Date
                </th>
                <th className="px-3 py-2 text-left font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Type
                </th>
                <th className="px-3 py-2 text-left font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Narration
                </th>
                <th className="px-3 py-2 text-left font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Ref
                </th>
                <th className="px-3 py-2 text-right font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Receipts
                </th>
                <th className="px-3 py-2 text-right font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Payments
                </th>
                <th className="px-3 py-2 text-right font-sans font-medium text-muted-foreground tracking-wide uppercase text-[10px]">
                  Balance
                </th>
                {canDelete && <th className="px-2 py-2 w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, isInflow, balance }) => (
                <tr
                  key={entry.id}
                  className="border-t border-[hsl(10_32%_85%)] hover:bg-[hsl(10_50%_98%)] transition-colors"
                >
                  <td className="px-3 py-2 font-sans text-foreground whitespace-nowrap">
                    {formatDate(entry.entryDate)}
                  </td>
                  <td className="px-3 py-2 font-sans text-muted-foreground whitespace-nowrap">
                    {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                  </td>
                  <td className="px-3 py-2 font-sans text-foreground">
                    <span>{entry.narration}</span>
                    {entry.supplier && (
                      <span className="text-muted-foreground ml-1">— {entry.supplier.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-sans text-muted-foreground whitespace-nowrap">
                    {entry.referenceNumber ?? ''}
                  </td>
                  <td className="px-3 py-2 text-right font-sans text-foreground">
                    {isInflow ? formatCurrency(entry.amountCents) : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-sans text-foreground">
                    {!isInflow ? formatCurrency(entry.amountCents) : ''}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-sans font-medium"
                    style={{ color: balance >= 0 ? '#B08B82' : '#9A3A3A' }}
                  >
                    {formatCurrency(balance)}
                  </td>
                  {canDelete && (
                    <td className="px-2 py-2">
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <BusinessEntryForm
          matterId={matterId}
          onSaved={() => {
            setShowForm(false)
            fetchEntries()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ─── Inline entry form ────────────────────────────────────────────────────────

interface FormProps {
  matterId: string
  onSaved: () => void
  onCancel: () => void
}

function BusinessEntryForm({ matterId, onSaved, onCancel }: FormProps) {
  const [entryType, setEntryType] = useState('matter_receipt')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saving, setSaving] = useState(false)

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
          matterId,
          entryType,
          entryDate,
          amountCents,
          narration: narration.trim(),
          referenceNumber: referenceNumber.trim() || null,
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

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#B08B82]'

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[hsl(10_32%_85%)] bg-[hsl(10_50%_97%)] p-4 space-y-3"
    >
      <p className="font-sans text-[10px] tracking-widest uppercase text-[#B08B82] mb-1">
        New Business Entry
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Type</label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className={inputCls}
          >
            <option value="matter_receipt">Matter Receipt</option>
            <option value="matter_payment">Matter Payment</option>
            <option value="business_receipt">Business Receipt</option>
            <option value="business_payment">Business Payment</option>
            <option value="supplier_invoice">Supplier Invoice</option>
            <option value="supplier_payment">Supplier Payment</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Amount (R)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Reference</label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="font-sans text-xs text-muted-foreground block mb-1">Narration</label>
        <input
          type="text"
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          placeholder="e.g. Payment received from client"
          required
          className={inputCls}
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="font-sans text-xs tracking-wide uppercase"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={saving}
          className="font-sans text-xs tracking-wide uppercase"
          style={{ backgroundColor: '#B08B82', color: '#fff' }}
        >
          {saving ? 'Saving…' : 'Save Entry'}
        </Button>
      </div>
    </form>
  )
}
