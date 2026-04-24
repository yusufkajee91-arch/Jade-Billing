'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Upload,
  FileText,
  Clock,
  Trash2,
  CheckSquare,
  Receipt,
  ArrowRightLeft,
  ArrowUpRight,
} from 'lucide-react'
import type { Session } from 'next-auth'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { FicaBadge } from '@/components/ui/fica-badge'
import { MatterStatusBadge } from '@/components/ui/matter-status-badge'
import { MatterForm } from '@/components/matters/matter-form'
import { FeeEntryForm } from '@/components/time-recording/fee-entry-form'
import { useTimeRecording } from '@/components/time-recording/time-recording-provider'
import { TrustLedger } from '@/components/bookkeeping/trust-ledger'
import { BusinessLedger } from '@/components/bookkeeping/business-ledger'
import { formatCurrency } from '@/lib/utils'
import { formatMinutes } from '@/lib/time-parser'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('MatterDetail')

// ─── Constants ────────────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatterUser {
  userId: string
  user: { id: string; firstName: string; lastName: string; initials: string; role: string }
}

interface MatterNote {
  id: string
  content: string
  createdAt: string
  createdBy: { id: string; firstName: string; lastName: string }
}

interface MatterAttachment {
  id: string
  fileName: string
  fileSizeBytes: number | null
  mimeType: string | null
  description: string | null
  uploadedAt: string
  uploadedBy: { id: string; firstName: string; lastName: string }
}

interface FeeEntry {
  id: string
  matterId: string
  entryType: 'time' | 'unitary' | 'disbursement'
  entryDate: string
  narration: string
  durationMinutesRaw: number | null
  durationMinutesBilled: number | null
  unitQuantityThousandths: number | null
  rateCents: number
  amountCents: number
  discountPct: number
  discountCents: number
  totalCents: number
  isBillable: boolean
  isInvoiced: boolean
  receiptFileName: string | null
  postingCodeId: string | null
  feeEarnerId: string
  createdAt: string
  feeEarner: { id: string; firstName: string; lastName: string; initials: string }
  postingCode: { id: string; code: string; description: string } | null
}

interface EntrySummary {
  feesCents: number
  disbCents: number
}

interface ToDoItem {
  id: string
  text: string
  done: boolean
}

interface MatterWithRelations {
  id: string
  matterCode: string
  description: string
  status: string
  dateOpened: string
  dateClosed: string | null
  notes: string | null
  // Practice Notes fields
  matterStatusNote: string | null
  toDo: ToDoItem[] | null
  allocation: string | null
  comment: string | null
  billingStatus: 'not_yet_billed' | 'awaiting_payment' | 'paid'
  loeFicaDone: boolean
  clientId: string
  ownerId: string
  matterTypeId: string | null
  departmentId: string | null
  client: {
    id: string
    clientCode: string
    clientName: string
    ficaStatus: string
    entityType: string
  }
  owner: { id: string; firstName: string; lastName: string; initials: string; role: string }
  matterType: { id: string; name: string } | null
  department: { id: string; name: string } | null
  matterUsers: MatterUser[]
  attachments: MatterAttachment[]
  matterNotes: MatterNote[]
  diaryEntries: unknown[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Fee Entries Tab ──────────────────────────────────────────────────────────

function FeeEntriesTab({
  matterId,
  session,
  onEntryChanged,
}: {
  matterId: string
  session: Session
  onEntryChanged: () => void
}) {
  const [entries, setEntries] = useState<FeeEntry[]>([])
  const [summary, setSummary] = useState<EntrySummary>({ feesCents: 0, disbCents: 0 })
  const [subTab, setSubTab] = useState<'fees' | 'disbursements' | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editEntry, setEditEntry] = useState<FeeEntry | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const { open } = useTimeRecording()
  const router = useRouter()

  const load = useCallback(async () => {
    log.debug('loading fee entries', { matterId, subTab })
    setLoading(true)
    try {
      const res = await fetch(`/api/matters/${matterId}/fee-entries?tab=${subTab}`)
      if (res.ok) {
        const data = await res.json()
        log.info('fee entries loaded', { matterId, count: data.entries?.length ?? 0, feesCents: data.summary?.feesCents, disbCents: data.summary?.disbCents })
        setEntries(data.entries ?? [])
        setSummary(data.summary ?? { feesCents: 0, disbCents: 0 })
      } else {
        log.warn('fee entries fetch failed', { status: res.status })
      }
    } finally {
      setLoading(false)
    }
  }, [matterId, subTab])

  useEffect(() => {
    load()
  }, [load])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map((e) => e.id)))
    }
  }

  const deleteEntry = async (id: string) => {
    log.info('deleting fee entry', { id })
    const res = await fetch(`/api/fee-entries/${id}`, { method: 'DELETE' })
    if (res.ok) {
      log.info('fee entry deleted', { id })
      toast.success('Entry deleted')
      setDeleteConfirmId(null)
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
      load()
      onEntryChanged()
    } else {
      const err = await res.json().catch(() => ({}))
      log.error('fee entry delete failed', { id, error: err.error })
      toast.error(err.error || 'Failed to delete entry')
    }
  }

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/fee-entries/${id}`, { method: 'DELETE' }))
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    toast.success(`${succeeded} entr${succeeded === 1 ? 'y' : 'ies'} deleted`)
    setBulkDeleteConfirm(false)
    setSelected(new Set())
    load()
    onEntryChanged()
  }

  const totalCombined = summary.feesCents + summary.disbCents
  const subTabs = [
    { id: 'all', label: 'All Unbilled' },
    { id: 'fees', label: 'Fees' },
    { id: 'disbursements', label: 'Disbursements' },
  ] as const

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Fees', value: summary.feesCents },
          { label: 'Disbursements', value: summary.disbCents },
          { label: 'Total', value: totalCombined },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 4 }}>{label}</p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#B08B82' }}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Sub-tab bar + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0 border-b border-border">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSubTab(t.id); setSelected(new Set()) }}
              className={`px-3 py-2 font-sans text-[11px] tracking-wide uppercase border-b-2 transition-colors ${
                subTab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ids = Array.from(selected).join(',')
                  router.push(`/invoices/new?matterId=${matterId}&entries=${ids}`)
                }}
                className="font-sans text-xs tracking-wide uppercase"
              >
                <Receipt className="h-3 w-3 mr-1" />
                Invoice ({selected.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDeleteConfirm(true)}
                className="font-sans text-xs tracking-wide uppercase text-destructive border-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete ({selected.size})
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => open(matterId)}
            className="bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase"
          >
            <Clock className="h-3 w-3 mr-1.5" />
            Record Time
          </Button>
        </div>
      </div>

      {/* Entries table */}
      {loading ? (
        <p className="font-sans text-sm text-muted-foreground py-4">Loading…</p>
      ) : entries.length === 0 ? (
        <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <Clock style={{ width: 32, height: 32, color: '#B08B82', margin: '0 auto 12px' }} strokeWidth={1.5} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#80796F', fontStyle: 'italic' }}>No unbilled entries.</p>
          <button
            onClick={() => open(matterId)}
            style={{ marginTop: 12, fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#B08B82', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Record the first entry →
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          {/* Table header */}
          <div className="table-header-bg flex items-center px-3 py-2 border-b border-border gap-0">
            <div style={{ width: 32, flexShrink: 0 }}>
              <button onClick={toggleAll} className="p-0.5 hover:opacity-70">
                <CheckSquare
                  className={`h-3.5 w-3.5 ${
                    selected.size === entries.length && entries.length > 0
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            </div>
            <p style={{ width: 100, flexShrink: 0 }} className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
              Date
            </p>
            <p style={{ width: 140, flexShrink: 0 }} className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
              Fee Earner
            </p>
            <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground flex-1 min-w-0">
              Description
            </p>
            <p style={{ width: 80, flexShrink: 0 }} className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right">
              Duration
            </p>
            <p style={{ width: 100, flexShrink: 0 }} className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right">
              Amount
            </p>
            <p style={{ width: 80, flexShrink: 0 }} className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right">
              Actions
            </p>
          </div>

          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center px-3 py-3 border-b border-border last:border-0 gap-0 ${
                i % 2 === 0 ? '' : 'table-row-stripe'
              } ${selected.has(entry.id) ? 'bg-secondary/60' : ''}`}
            >
              <div style={{ width: 32, flexShrink: 0 }} className="self-start pt-0.5">
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  onChange={() => toggleSelect(entry.id)}
                  className="h-3.5 w-3.5 accent-primary"
                />
              </div>
              <div style={{ width: 100, flexShrink: 0 }} className="self-start">
                <span className="font-sans text-xs text-muted-foreground">
                  {formatDate(entry.entryDate)}
                </span>
              </div>
              <div style={{ width: 140, flexShrink: 0 }} className="self-start">
                <span className="font-sans text-xs text-foreground">
                  {entry.feeEarner.firstName} {entry.feeEarner.lastName}
                </span>
                {!entry.isBillable && (
                  <span className="font-sans text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded ml-1">
                    Non-billable
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 self-start pr-3">
                <p className="font-sans text-sm text-foreground leading-snug">
                  {entry.narration}
                </p>
                {entry.postingCode && (
                  <span className="font-sans text-[10px] text-muted-foreground">
                    {entry.postingCode.code}
                  </span>
                )}
              </div>
              <div style={{ width: 80, flexShrink: 0 }} className="text-right font-sans text-xs text-muted-foreground self-center whitespace-nowrap">
                {entry.entryType === 'time' && entry.durationMinutesBilled !== null
                  ? formatMinutes(entry.durationMinutesBilled)
                  : entry.entryType === 'unitary' && entry.unitQuantityThousandths !== null
                  ? `×${(entry.unitQuantityThousandths / 1000).toFixed(3)}`
                  : '—'}
              </div>
              <div style={{ width: 100, flexShrink: 0 }} className="text-right self-center">
                <p className="font-sans text-sm" style={{ color: '#B08B82' }}>
                  {formatCurrency(entry.totalCents)}
                </p>
                {entry.discountPct > 0 && (
                  <p className="font-sans text-[10px] text-muted-foreground">
                    {entry.discountPct}% disc
                  </p>
                )}
              </div>
              <div style={{ width: 80, flexShrink: 0 }} className="flex items-center justify-end gap-1 self-center">
                <button
                  onClick={() => setEditEntry(entry)}
                  className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(entry.id)}
                  className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline edit slide-over */}
      <Sheet open={Boolean(editEntry)} onOpenChange={(o) => !o && setEditEntry(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">Edit Entry</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {editEntry && (
              <FeeEntryForm
                defaultMatterId={matterId}
                existingEntry={editEntry}
                session={{
                  user: {
                    id: session.user.id!,
                    role: session.user.role!,
                    initials: session.user.initials!,
                  },
                }}
                onClose={() => setEditEntry(null)}
                onSaved={() => {
                  setEditEntry(null)
                  load()
                  onEntryChanged()
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(o) => !o && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-light">Delete Entry</h3>
            <p className="font-sans text-sm text-muted-foreground">
              Are you sure you want to delete this entry? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="font-sans text-xs tracking-wide uppercase"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteConfirmId && deleteEntry(deleteConfirmId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-sans text-xs tracking-widest uppercase"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm dialog */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-light">Delete {selected.size} Entries</h3>
            <p className="font-sans text-sm text-muted-foreground">
              Are you sure you want to delete {selected.size} entr
              {selected.size === 1 ? 'y' : 'ies'}? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setBulkDeleteConfirm(false)}
                className="font-sans text-xs tracking-wide uppercase"
              >
                Cancel
              </Button>
              <Button
                onClick={bulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-sans text-xs tracking-widest uppercase"
              >
                Delete All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Business & Trust Tab ────────────────────────────────────────────────────

function BusinessTrustTab({ matterId, session }: { matterId: string; session: Session }) {
  const isAdmin = session.user.role === 'admin'
  const canPost = session.user.role === 'admin' || session.user.role === 'fee_earner'

  const [showInterTransfer, setShowInterTransfer] = useState(false)
  const [showTrustToBusiness, setShowTrustToBusiness] = useState(false)
  const [trustKey, setTrustKey] = useState(0)
  const [businessKey, setBusinessKey] = useState(0)

  const refreshTrust = () => setTrustKey((k) => k + 1)
  const refreshBusiness = () => setBusinessKey((k) => k + 1)

  return (
    <div className="space-y-6">
      {/* Matter-level transfer actions */}
      {canPost && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowInterTransfer((v) => !v)}
            className="inline-flex items-center gap-1.5 font-sans text-xs tracking-wide uppercase text-[#8897C0] hover:underline"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transfer Trust Funds
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowTrustToBusiness((v) => !v)}
              className="inline-flex items-center gap-1.5 font-sans text-xs tracking-wide uppercase text-[#B08B82] hover:underline"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Transfer to Business
            </button>
          )}
        </div>
      )}

      {/* Inter-matter transfer panel */}
      {showInterTransfer && (
        <MatterInterTransferForm
          fromMatterId={matterId}
          onSaved={() => { setShowInterTransfer(false); refreshTrust() }}
          onCancel={() => setShowInterTransfer(false)}
        />
      )}

      {/* Trust-to-business panel */}
      {showTrustToBusiness && (
        <MatterTrustToBusinessForm
          matterId={matterId}
          onSaved={() => { setShowTrustToBusiness(false); refreshTrust(); refreshBusiness() }}
          onCancel={() => setShowTrustToBusiness(false)}
        />
      )}

      <TrustLedger key={`trust-${trustKey}`} matterId={matterId} session={session} />
      <div className="border-t border-border" />
      <BusinessLedger key={`business-${businessKey}`} matterId={matterId} session={session} />
    </div>
  )
}

// ─── Matter-scoped Inter-Matter Transfer Form ─────────────────────────────────

function MatterInterTransferForm({
  fromMatterId,
  onSaved,
  onCancel,
}: {
  fromMatterId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [toMatterCode, setToMatterCode] = useState('')
  const [toMatterId, setToMatterId] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saving, setSaving] = useState(false)

  async function lookupToMatter() {
    if (!toMatterCode.trim()) { setToMatterId(null); return }
    const res = await fetch(`/api/matters?code=${encodeURIComponent(toMatterCode.trim())}`)
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) setToMatterId(data[0].id)
      else { setToMatterId(null); toast.error(`Matter "${toMatterCode}" not found`) }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) { toast.error('Enter a valid amount'); return }
    if (!toMatterId) { toast.error('Enter a valid destination matter code'); return }

    log.info('matter trust transfer submitting', { fromMatterId, toMatterId, amountCents })
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
        const d = await res.json().catch(() => ({}))
        log.error('matter trust transfer failed', { status: res.status, error: d.error })
        toast.error(d.error ?? 'Transfer failed')
        return
      }
      log.info('matter trust transfer completed')
      toast.success('Trust funds transferred')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8897C0]'

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[hsl(225_35%_90%)] bg-[hsl(225_40%_97%)] p-4 space-y-3"
    >
      <p className="font-sans text-[10px] tracking-widest uppercase text-[#8897C0]">
        Transfer Trust Funds to Another Matter
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">To Matter Code</label>
          <input
            type="text"
            value={toMatterCode}
            onChange={(e) => setToMatterCode(e.target.value)}
            onBlur={lookupToMatter}
            placeholder="e.g. JD/CLI/002"
            required
            className={inputCls}
          />
          {toMatterId && <p className="font-sans text-[10px] text-[#8897C0] mt-0.5">✓ Found</p>}
        </div>
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required className={inputCls} />
        </div>
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Narration</label>
          <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Transfer of funds" required className={inputCls} />
        </div>
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Reference</label>
          <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="font-sans text-xs tracking-wide uppercase">Cancel</Button>
        <Button type="submit" size="sm" disabled={saving} className="font-sans text-xs tracking-wide uppercase" style={{ backgroundColor: '#8897C0', color: '#fff' }}>
          {saving ? 'Transferring…' : 'Transfer Funds'}
        </Button>
      </div>
    </form>
  )
}

// ─── Matter-scoped Trust-to-Business Form ─────────────────────────────────────

function MatterTrustToBusinessForm({
  matterId,
  onSaved,
  onCancel,
}: {
  matterId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [narration, setNarration] = useState('Section 78(1) transfer — fees earned')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) { toast.error('Enter a valid amount'); return }

    log.info('matter trust-to-business submitting', { matterId, amountCents })
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
        const d = await res.json().catch(() => ({}))
        log.error('matter trust-to-business failed', { status: res.status, error: d.error })
        toast.error(d.error ?? 'Transfer failed')
        return
      }
      log.info('matter trust-to-business completed')
      toast.success('Transferred to business account')
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
      <p className="font-sans text-[10px] tracking-widest uppercase text-[#B08B82]">
        Transfer Trust Funds to Business Account
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-sans text-xs text-muted-foreground block mb-1">Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required className={inputCls} />
        </div>
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
          <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="font-sans text-xs text-muted-foreground block mb-1">Narration</label>
        <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} required className={inputCls} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="font-sans text-xs tracking-wide uppercase">Cancel</Button>
        <Button type="submit" size="sm" disabled={saving} className="font-sans text-xs tracking-wide uppercase" style={{ backgroundColor: '#B08B82', color: '#fff' }}>
          {saving ? 'Transferring…' : 'Transfer to Business'}
        </Button>
      </div>
    </form>
  )
}

// ─── Associated Matters Tab ───────────────────────────────────────────────────

interface AssociatedMatter {
  matterId: string
  associatedMatterId: string
  relationshipNote: string | null
  relatedMatter: {
    id: string
    matterCode: string
    description: string
    status: string
    client: { id: string; clientName: string; clientCode: string }
  }
}

function AssociatedMattersTab({ matterId }: { matterId: string }) {
  const [associations, setAssociations] = useState<AssociatedMatter[] | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; matterCode: string; description: string; client: { clientName: string } }[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/matters/${matterId}/associations`)
    if (res.ok) setAssociations(await res.json())
    else setAssociations([])
  }, [matterId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/matters?q=${encodeURIComponent(q)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.matters ?? [])
        setSearchResults(list.filter((m: { id: string }) => m.id !== matterId).slice(0, 8))
      }
      setSearching(false)
    }, 300)
  }

  const addAssociation = async (associatedMatterId: string) => {
    setAdding(true)
    const res = await fetch(`/api/matters/${matterId}/associations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ associatedMatterId }),
    })
    if (res.ok) {
      toast.success('Association added')
      setSearch('')
      setSearchResults([])
      load()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to add association')
    }
    setAdding(false)
  }

  const removeAssociation = async (assoc: AssociatedMatter) => {
    const otherId = assoc.relatedMatter.id
    const res = await fetch(`/api/matters/${matterId}/associations?associatedMatterId=${otherId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Association removed')
      load()
    } else {
      toast.error('Failed to remove association')
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
    borderBottom: '1px solid rgba(216,211,203,0.4)',
  }

  if (associations === null) return <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>Loading…</p>

  return (
    <div className="space-y-5">
      {/* Search to add */}
      <div>
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
          Link a Matter
        </p>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by matter code or description…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D8D3CB', background: 'rgba(241,237,234,0.6)', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A', outline: 'none' }}
          />
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #D8D3CB', borderRadius: 8, boxShadow: '0 8px 24px rgba(74,72,69,0.12)', marginTop: 4, overflow: 'hidden' }}>
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => !adding && addAssociation(m.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid rgba(216,211,203,0.4)', background: 'none', cursor: 'pointer', display: 'block' }}
                >
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82', marginRight: 8, fontWeight: 600 }}>{m.matterCode}</span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#2C2C2A' }}>{m.description}</span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', marginLeft: 8 }}>{m.client.clientName}</span>
                </button>
              ))}
              {searching && <p style={{ padding: '8px 14px', fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>Searching…</p>}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {associations.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic' }}>No associated matters.</p>
      ) : (
        <div>
          {associations.map((assoc) => (
            <div key={assoc.relatedMatter.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link href={`/matters/${assoc.relatedMatter.id}`} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#B08B82', fontWeight: 600, textDecoration: 'none' }}>
                    {assoc.relatedMatter.matterCode}
                  </Link>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{assoc.relatedMatter.description}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', marginTop: 2 }}>
                  {assoc.relatedMatter.client.clientName}
                  {assoc.relatedMatter.status !== 'open' && (
                    <span style={{ marginLeft: 8, color: assoc.relatedMatter.status === 'closed' ? '#9A3A3A' : '#80796F' }}>
                      {assoc.relatedMatter.status}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => removeAssociation(assoc)}
                style={{ color: '#80796F', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                title="Remove association"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Practice Notes Tab ───────────────────────────────────────────────────────

const BILLING_STATUS_LABELS: Record<string, string> = {
  not_yet_billed: 'Not Yet Billed',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
}

function PracticeNotesTab({
  matter,
  onSaved,
}: {
  matter: MatterWithRelations
  onSaved: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [toDoItems, setToDoItems] = useState<ToDoItem[]>(() => matter.toDo ?? [])
  const [newTodoText, setNewTodoText] = useState('')

  const saveField = async (field: string, value: unknown) => {
    setSaving(field)
    try {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to save')
      } else {
        onSaved()
      }
    } finally {
      setSaving(null)
    }
  }

  const addTodo = async () => {
    const text = newTodoText.trim()
    if (!text) return
    const next: ToDoItem[] = [...toDoItems, { id: crypto.randomUUID(), text, done: false }]
    setToDoItems(next)
    setNewTodoText('')
    await saveField('toDo', next)
  }

  const toggleTodo = async (id: string) => {
    const next = toDoItems.map((t) => t.id === id ? { ...t, done: !t.done } : t)
    setToDoItems(next)
    await saveField('toDo', next)
  }

  const deleteTodo = async (id: string) => {
    const next = toDoItems.filter((t) => t.id !== id)
    setToDoItems(next)
    await saveField('toDo', next)
  }

  const fieldLabel: React.CSSProperties = {
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#80796F',
    marginBottom: 6,
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #D8D3CB',
    background: 'rgba(241,237,234,0.6)',
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 13,
    color: '#2C2C2A',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #D8D3CB',
    background: 'rgba(241,237,234,0.6)',
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 13,
    color: '#2C2C2A',
    outline: 'none',
  }

  return (
    <div className="space-y-6">
      {/* Status Note */}
      <div>
        <p style={fieldLabel}>Status Note {saving === 'matterStatusNote' && <span style={{ color: '#B08B82' }}>Saving…</span>}</p>
        <textarea
          defaultValue={matter.matterStatusNote ?? ''}
          rows={3}
          style={textareaStyle}
          onBlur={(e) => {
            const val = e.target.value.trim() || null
            if (val !== (matter.matterStatusNote ?? null)) saveField('matterStatusNote', val)
          }}
          placeholder="Current status of this matter…"
        />
      </div>

      {/* Allocation */}
      <div>
        <p style={fieldLabel}>Allocation {saving === 'allocation' && <span style={{ color: '#B08B82' }}>Saving…</span>}</p>
        <input
          type="text"
          defaultValue={matter.allocation ?? ''}
          style={inputStyle}
          onBlur={(e) => {
            const val = e.target.value.trim() || null
            if (val !== (matter.allocation ?? null)) saveField('allocation', val)
          }}
          placeholder="e.g. Senior Attorney"
        />
      </div>

      {/* Comment */}
      <div>
        <p style={fieldLabel}>Comment {saving === 'comment' && <span style={{ color: '#B08B82' }}>Saving…</span>}</p>
        <textarea
          defaultValue={matter.comment ?? ''}
          rows={3}
          style={textareaStyle}
          onBlur={(e) => {
            const val = e.target.value.trim() || null
            if (val !== (matter.comment ?? null)) saveField('comment', val)
          }}
          placeholder="General comment…"
        />
      </div>

      {/* Billing Status */}
      <div>
        <p style={fieldLabel}>Billing Status {saving === 'billingStatus' && <span style={{ color: '#B08B82' }}>Saving…</span>}</p>
        <select
          defaultValue={matter.billingStatus}
          style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
          onChange={(e) => saveField('billingStatus', e.target.value)}
        >
          <option value="not_yet_billed">{BILLING_STATUS_LABELS.not_yet_billed}</option>
          <option value="awaiting_payment">{BILLING_STATUS_LABELS.awaiting_payment}</option>
          <option value="paid">{BILLING_STATUS_LABELS.paid}</option>
        </select>
      </div>

      {/* LOE / FICA Done */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="loeFicaDone"
          defaultChecked={matter.loeFicaDone}
          onChange={(e) => saveField('loeFicaDone', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#B08B82', cursor: 'pointer' }}
        />
        <label htmlFor="loeFicaDone" style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#3E3B36', cursor: 'pointer' }}>
          LOE / FICA Done {saving === 'loeFicaDone' && <span style={{ color: '#B08B82' }}>Saving…</span>}
        </label>
      </div>

      {/* To-Do list */}
      <div>
        <p style={fieldLabel}>To-Do {saving === 'toDo' && <span style={{ color: '#B08B82' }}>Saving…</span>}</p>
        <div className="space-y-2 mb-3">
          {toDoItems.length === 0 && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', fontStyle: 'italic' }}>No to-do items.</p>
          )}
          {toDoItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleTodo(item.id)}
                style={{ width: 15, height: 15, accentColor: '#B08B82', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: item.done ? '#80796F' : '#2C2C2A', textDecoration: item.done ? 'line-through' : 'none', flex: 1 }}>
                {item.text}
              </span>
              <button
                onClick={() => deleteTodo(item.id)}
                style={{ color: '#80796F', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo() } }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Add a to-do item…"
          />
          <button
            onClick={addTodo}
            disabled={!newTodoText.trim()}
            style={{ padding: '8px 14px', borderRadius: 8, background: '#B08B82', color: '#fff', fontFamily: 'var(--font-noto-sans)', fontSize: 12, border: 'none', cursor: 'pointer', opacity: newTodoText.trim() ? 1 : 0.5 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MatterDetailProps {
  matter: MatterWithRelations
  session: Session
}

export function MatterDetail({ matter: initialMatter, session }: MatterDetailProps) {
  log.info('mount', { matterId: initialMatter.id, matterCode: initialMatter.matterCode, status: initialMatter.status })
  const [matter, setMatter] = useState(initialMatter)
  const [activeTab, setActiveTab] = useState('fees')
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const isAdmin = session.user.role === 'admin'
  const isOwner = matter.ownerId === session.user.id
  const canEdit = isAdmin || isOwner

  const refreshMatter = useCallback(async () => {
    log.debug('refreshing matter data', { matterId: matter.id })
    const res = await fetch(`/api/matters/${matter.id}`)
    if (res.ok) {
      log.info('matter data refreshed')
      setMatter(await res.json())
    } else {
      log.warn('matter refresh failed', { status: res.status })
    }
  }, [matter.id])

  const closeMatter = async () => {
    log.info('closing matter', { matterId: matter.id })
    setClosing(true)
    try {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      if (!res.ok) throw new Error()
      log.info('matter closed')
      toast.success('Matter closed')
      setCloseDialogOpen(false)
      refreshMatter()
    } catch {
      log.error('failed to close matter', { matterId: matter.id })
      toast.error('Failed to close matter')
    } finally {
      setClosing(false)
    }
  }

  const addNote = async () => {
    if (!noteContent.trim()) return
    log.info('adding note', { matterId: matter.id })
    setAddingNote(true)
    try {
      const res = await fetch(`/api/matters/${matter.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      })
      if (!res.ok) throw new Error()
      log.info('note added')
      toast.success('Note added')
      setNoteContent('')
      refreshMatter()
    } catch {
      log.error('failed to add note', { matterId: matter.id })
      toast.error('Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    log.info('uploading attachment', { matterId: matter.id, fileName: file.name, fileSize: file.size })
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/matters/${matter.id}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error()
      log.info('attachment uploaded')
      toast.success('Attachment uploaded')
      refreshMatter()
    } catch {
      log.error('attachment upload failed', { matterId: matter.id })
      toast.error('Failed to upload attachment')
    } finally {
      setUploading(false)
    }
  }

  const tabs = [
    { id: 'fees', label: 'Unbilled Fees' },
    { id: 'notes', label: 'Notes' },
    { id: 'attachments', label: 'Attachments' },
    { id: 'business', label: 'Business & Trust' },
    { id: 'associated', label: 'Associated Matters' },
    { id: 'practice', label: 'Practice Notes' },
  ]

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link
              href="/matters"
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.45)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeft style={{ width: 12, height: 12 }} />
              Matters
            </Link>
            <span style={{ color: 'rgba(241,237,234,0.30)', fontSize: 11 }}>/</span>
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)' }}>
              {matter.client.clientCode} — {matter.client.clientName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#B08B82' }}>{matter.matterCode}</span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
              {matter.description}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <MatterStatusBadge status={matter.status} />
            {matter.matterType && (
              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)' }}>{matter.matterType.name}</span>
            )}
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)' }}>
              <span style={{ fontFamily: 'var(--font-noto-sans)', marginRight: 4 }}>{matter.owner.initials}</span>
              {matter.owner.firstName} {matter.owner.lastName}
            </span>
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)' }}>
              Opened {formatDate(matter.dateOpened)}
            </span>
            <Link href={`/clients/${matter.client.id}?tab=fica`}>
              <FicaBadge status={matter.client.ficaStatus} />
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {canEdit && (
            <button
              onClick={() => setEditSheetOpen(true)}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.80)', background: 'rgba(255,255,255,0.12)', borderRadius: 40, padding: '8px 18px', border: '1px solid rgba(255,255,255,0.20)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Pencil style={{ width: 12, height: 12 }} />
              Edit
            </button>
          )}
          {matter.status === 'open' && canEdit && (
            <button
              onClick={() => setCloseDialogOpen(true)}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.55)', background: 'none', borderRadius: 40, padding: '8px 18px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
            >
              Close Matter
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Matter Details Panel */}
          <div style={{ ...GLASS, padding: 24 }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 16 }}>
              Matter Details
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {matter.matterType && (
                <div>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginBottom: 2 }}>Type</p>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36' }}>{matter.matterType.name}</p>
                </div>
              )}
              {matter.department && (
                <div>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginBottom: 2 }}>Department</p>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36' }}>{matter.department.name}</p>
                </div>
              )}
              <div>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginBottom: 2 }}>Owner</p>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36' }}>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', marginRight: 4 }}>{matter.owner.initials}</span>
                  {matter.owner.firstName} {matter.owner.lastName}
                </p>
              </div>
              {matter.matterUsers.length > 0 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginBottom: 2 }}>Users with Access</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {matter.matterUsers.map((mu) => (
                      <span key={mu.userId} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                        {mu.user.initials}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {matter.notes && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(216,211,203,0.5)' }}>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginBottom: 4 }}>Notes</p>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', whiteSpace: 'pre-wrap' }}>{matter.notes}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ ...GLASS, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(216,211,203,0.5)', padding: '0 20px' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { log.debug('tab changed', { tab: tab.id }); setActiveTab(tab.id) }}
                  style={{
                    fontFamily: 'var(--font-noto-sans)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab.id ? '#B08B82' : 'transparent'}`,
                    background: 'none',
                    cursor: 'pointer',
                    color: activeTab === tab.id ? '#3E3B36' : '#80796F',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 24 }}>

          {/* Unbilled Fees Tab */}
          {activeTab === 'fees' && (
            <FeeEntriesTab
              matterId={matter.id}
              session={session}
              onEntryChanged={refreshMatter}
            />
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                  placeholder="Add a note…"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <Button
                  onClick={addNote}
                  disabled={addingNote || !noteContent.trim()}
                  className="bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase self-end"
                >
                  {addingNote ? 'Adding…' : 'Add Note'}
                </Button>
              </div>

              {matter.matterNotes.length === 0 ? (
                <p className="font-sans text-sm text-muted-foreground italic py-4">
                  No notes yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {matter.matterNotes.map((note) => (
                    <div key={note.id} style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 10, padding: 16 }}>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                        {note.content}
                      </p>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                        {note.createdBy.firstName} {note.createdBy.lastName} · {formatDate(note.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="font-sans text-xs tracking-wide uppercase"
                >
                  <Upload className="h-3 w-3 mr-1.5" />
                  {uploading ? 'Uploading…' : 'Upload Attachment'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                  }}
                />
              </div>

              {matter.attachments.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-sans text-sm text-muted-foreground">No attachments yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {matter.attachments.map((att) => (
                    <div key={att.id} style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36' }}>{att.fileName}</p>
                        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                          {formatFileSize(att.fileSizeBytes)} · {formatDate(att.uploadedAt)} · {att.uploadedBy.firstName} {att.uploadedBy.lastName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Business & Trust tab */}
          {activeTab === 'business' && (
            <BusinessTrustTab matterId={matter.id} session={session} />
          )}

          {/* Associated Matters tab */}
          {activeTab === 'associated' && (
            <AssociatedMattersTab matterId={matter.id} />
          )}

          {/* Practice Notes tab */}
          {activeTab === 'practice' && (
            <PracticeNotesTab matter={matter} onSaved={refreshMatter} />
          )}
            </div>{/* close padding div */}
          </div>{/* close glass card */}
        </div>

        {/* Right sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...GLASS, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CalendarDays style={{ width: 16, height: 16, color: '#80796F' }} />
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F' }}>
                Diary
              </p>
            </div>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic' }}>
              Diary entries will appear here (Phase 8).
            </p>
          </div>
        </div>
      </div>

      {/* Edit Matter Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">Edit Matter</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <MatterForm
              matter={{
                id: matter.id,
                matterCode: matter.matterCode,
                description: matter.description,
                clientId: matter.clientId,
                ownerId: matter.ownerId,
                matterTypeId: matter.matterTypeId,
                departmentId: matter.departmentId,
                notes: matter.notes,
                status: matter.status,
              }}
              onClose={() => setEditSheetOpen(false)}
              onSaved={() => {
                setEditSheetOpen(false)
                refreshMatter()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Close Matter Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-xl font-light">Close Matter</h3>
              <p className="font-sans text-sm text-muted-foreground mt-1">
                Are you sure you want to close this matter? This will set the status to
                &ldquo;Closed&rdquo; and record today as the close date.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setCloseDialogOpen(false)}
                className="font-sans text-xs tracking-wide uppercase"
              >
                Cancel
              </Button>
              <Button
                onClick={closeMatter}
                disabled={closing}
                className="bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase"
              >
                {closing ? 'Closing…' : 'Close Matter'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
