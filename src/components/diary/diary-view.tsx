'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, Pencil, Trash2, CalendarDays, List } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('DiaryView')

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiaryEntry {
  id: string
  title: string
  description: string | null
  dueDate: string // YYYY-MM-DD
  isCompleted: boolean
  completedAt: string | null
  matter: { id: string; matterCode: string; description: string }
  assignedTo: { id: string; firstName: string; lastName: string; initials: string } | null
  createdBy: { id: string; initials: string }
}

interface Matter {
  id: string
  matterCode: string
  description: string
  client: { clientName: string }
}

interface User {
  id: string
  firstName: string
  lastName: string
  initials: string
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  // 0=Sun … 6=Sat; we want Mon-start: Mon=0 … Sun=6
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Entry form ───────────────────────────────────────────────────────────────

interface EntryFormProps {
  isAdmin: boolean
  currentUserId: string
  initial?: DiaryEntry | null
  defaultDate?: string
  onSaved: (entry: DiaryEntry) => void
  onCancel: () => void
}

function EntryForm({ isAdmin, currentUserId, initial, defaultDate, onSaved, onCancel }: EntryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? defaultDate ?? '')
  const [matterId, setMatterId] = useState(initial?.matter.id ?? '')
  const [assignedToId, setAssignedToId] = useState(initial?.assignedTo?.id ?? currentUserId)
  const [saving, setSaving] = useState(false)
  const [matters, setMatters] = useState<Matter[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [matterSearch, setMatterSearch] = useState(initial ? `${initial.matter.matterCode} — ${initial.matter.description}` : '')
  const [showMatterList, setShowMatterList] = useState(false)

  // Load matters for selection
  useEffect(() => {
    const q = matterSearch.length >= 2 ? matterSearch : ''
    fetch(`/api/matters?q=${encodeURIComponent(q)}&limit=30`)
      .then((r) => r.json())
      .then((d) => setMatters(Array.isArray(d) ? d : d.matters ?? []))
      .catch(() => {})
  }, [matterSearch])

  // Load users (admin only)
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : d.users ?? []))
      .catch(() => {})
  }, [isAdmin])

  const submit = async () => {
    if (!title.trim() || !dueDate || !matterId) {
      log.warn('diary entry form validation failed', { hasTitle: !!title.trim(), hasDueDate: !!dueDate, hasMatterId: !!matterId })
      toast.error('Title, due date and matter are required')
      return
    }
    log.info('submitting diary entry', { title, dueDate, matterId, isEdit: !!initial })
    setSaving(true)
    const url = initial ? `/api/diary/${initial.id}` : '/api/diary'
    const method = initial ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: description || null, dueDate, matterId, assignedToId }),
    })
    setSaving(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      // Surface all Zod validation details when present (field errors + form errors)
      const fieldErrors = b.details?.fieldErrors as Record<string, string[]> | undefined
      const formErrors = b.details?.formErrors as string[] | undefined
      const parts = [
        ...(formErrors ?? []),
        ...Object.entries(fieldErrors ?? {}).flatMap(([f, msgs]) => msgs.map((m) => `${f}: ${m}`)),
      ]
      log.error('diary entry save failed', { status: res.status, error: b.error, fieldErrors })
      toast.error(parts.length > 0 ? parts.join(' · ') : b.error ?? 'Failed to save entry')
      return
    }
    log.info('diary entry saved successfully')
    onSaved(await res.json())
  }

  const inputCls = 'w-full h-9 px-3 rounded border border-border bg-background font-sans text-sm focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Title *</label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. File lodgement deadline" />
      </div>

      <div className="relative">
        <label className="block font-sans text-[10px] tracking-widests uppercase text-muted-foreground mb-1">Matter *</label>
        <input
          className={inputCls}
          value={matterSearch}
          onChange={(e) => { setMatterSearch(e.target.value); setMatterId(''); setShowMatterList(true) }}
          onFocus={() => setShowMatterList(true)}
          placeholder="Search matters…"
        />
        {showMatterList && matters.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
            {matters.map((m) => (
              <button
                key={m.id}
                className="w-full text-left px-3 py-2 hover:bg-muted/30 font-sans text-sm"
                onClick={() => { setMatterId(m.id); setMatterSearch(`${m.matterCode} — ${m.description}`); setShowMatterList(false) }}
              >
                <span className="font-sans text-xs text-muted-foreground mr-2">{m.matterCode}</span>
                {m.description}
                <span className="text-muted-foreground ml-1">({m.client.clientName})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block font-sans text-[10px] tracking-widests uppercase text-muted-foreground mb-1">Due Date *</label>
        <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      {isAdmin && users.length > 0 && (
        <div>
          <label className="block font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Assigned To</label>
          <select className={inputCls} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.initials} — {u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Notes</label>
        <textarea
          className={inputCls + ' h-20 resize-none py-2'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details…"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={saving}
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: saving ? '#c0a09a' : '#B08B82',
            borderRadius: 40,
            padding: '10px 22px',
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
          }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#93706A' }}
          onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#B08B82' }}
        >
          {saving ? 'Saving…' : initial ? 'Update' : 'Add Entry'}
        </button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#80796F',
            background: 'transparent',
            borderRadius: 40,
            padding: '10px 22px',
            border: '1px solid rgba(128,121,111,0.35)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: DiaryEntry
  currentUserId: string
  isAdmin: boolean
  onToggle: (id: string, done: boolean) => void
  onEdit: (entry: DiaryEntry) => void
  onDelete: (id: string) => void
}

function EntryCard({ entry, currentUserId, isAdmin, onToggle, onEdit, onDelete }: EntryCardProps) {
  const canEdit = isAdmin || entry.createdBy.id === currentUserId || entry.assignedTo?.id === currentUserId

  return (
    <div style={{
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.70)',
      background: entry.isCompleted ? 'rgba(255,252,250,0.35)' : 'rgba(255,252,250,0.62)',
      padding: '12px 16px',
      opacity: entry.isCompleted ? 0.7 : 1,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button
          onClick={() => onToggle(entry.id, !entry.isCompleted)}
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 18,
            height: 18,
            borderRadius: 4,
            border: entry.isCompleted ? 'none' : '1.5px solid rgba(128,121,111,0.40)',
            background: entry.isCompleted ? '#22c55e' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={entry.isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {entry.isCompleted && <Check style={{ width: 11, height: 11, color: 'white' }} strokeWidth={3} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 14,
            fontWeight: 500,
            color: entry.isCompleted ? '#80796F' : '#2C2C2A',
            margin: 0,
            textDecoration: entry.isCompleted ? 'line-through' : 'none',
          }}>
            {entry.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>
              {entry.matter.matterCode}
            </span>
            {entry.assignedTo && (
              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>
                → {entry.assignedTo.initials}
              </span>
            )}
          </div>
          {entry.description && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginTop: 4, lineHeight: 1.5 }}>
              {entry.description}
            </p>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => onEdit(entry)}
              style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#80796F', display: 'flex' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#2C2C2A'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#80796F'}
            >
              <Pencil style={{ width: 13, height: 13 }} />
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#80796F', display: 'flex' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#80796F'}
            >
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main DiaryView ───────────────────────────────────────────────────────────

const GLASS = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

export function DiaryView({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  log.info('mount', { isAdmin, currentUserId })
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate())
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    log.debug('loading diary entries', { year, month, scope })
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const dim = daysInMonth(year, month)
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(dim).padStart(2, '0')}`
    const res = await fetch(`/api/diary?from=${from}&to=${to}&scope=${scope}`)
    if (res.ok) {
      const data = await res.json()
      log.info('diary entries loaded', { count: data.length, from, to })
      setEntries(data)
    } else {
      log.warn('diary entries fetch failed', { status: res.status })
    }
    setLoading(false)
  }, [year, month, scope])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Build day → entries map
  const byDay = new Map<number, DiaryEntry[]>()
  for (const e of entries) {
    const d = parseInt(e.dueDate.slice(8, 10), 10)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(e)
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const handleToggle = async (id: string, done: boolean) => {
    log.info('toggling diary entry completion', { id, done })
    const res = await fetch(`/api/diary/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: done }),
    })
    if (res.ok) {
      const updated: DiaryEntry = await res.json()
      log.debug('diary entry toggled', { id, isCompleted: updated.isCompleted })
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    } else {
      log.error('diary entry toggle failed', { id, status: res.status })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this diary entry?')) return
    log.info('deleting diary entry', { id })
    const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      log.info('diary entry deleted', { id })
      setEntries((prev) => prev.filter((e) => e.id !== id))
      toast.success('Entry deleted')
    } else {
      log.error('diary entry delete failed', { id, status: res.status })
    }
  }

  const handleSaved = (entry: DiaryEntry) => {
    log.info('diary entry saved', { id: entry.id, title: entry.title })
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = entry
        return next
      }
      return [...prev, entry]
    })
    setShowForm(false)
    setEditingEntry(null)
  }

  const dim = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const selectedEntries = selectedDay ? (byDay.get(selectedDay) ?? []) : []
  const defaultFormDate = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : undefined

  const pendingCount = entries.filter((e) => !e.isCompleted).length

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header bar */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Practice
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Diary
          </h1>
          {pendingCount > 0 && (
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)', marginTop: 4 }}>
              {pendingCount} pending {pendingCount === 1 ? 'entry' : 'entries'} this month
            </p>
          )}
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Scope toggle (admin only) */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.10)', borderRadius: 40, padding: '3px 4px' }}>
              {(['mine', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  style={{
                    fontFamily: 'var(--font-noto-sans)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '6px 16px',
                    borderRadius: 40,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: scope === s ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: scope === s ? '#F1EDEA' : 'rgba(241,237,234,0.55)',
                  }}
                >
                  {s === 'mine' ? 'Mine' : 'All'}
                </button>
              ))}
            </div>
          )}

          {/* View toggle — glass pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.10)', borderRadius: 40, padding: '3px 4px' }}>
            <button
              onClick={() => setView('calendar')}
              title="Calendar view"
              style={{
                padding: '6px 12px',
                borderRadius: 40,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: view === 'calendar' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: view === 'calendar' ? '#F1EDEA' : 'rgba(241,237,234,0.55)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CalendarDays style={{ width: 15, height: 15 }} />
            </button>
            <button
              onClick={() => setView('list')}
              title="List view"
              style={{
                padding: '6px 12px',
                borderRadius: 40,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: view === 'list' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: view === 'list' ? '#F1EDEA' : 'rgba(241,237,234,0.55)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <List style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* New Entry button */}
          <button
            onClick={() => { setEditingEntry(null); setShowForm(true) }}
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: '#B08B82',
              borderRadius: 40,
              padding: '10px 22px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
          >
            <Plus style={{ width: 14, height: 14 }} />
            New Entry
          </button>
        </div>
      </div>

      {/* Add / edit form */}
      {(showForm || editingEntry) && (
        <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: '#2C2C2A', marginBottom: 16, marginTop: 0 }}>
            {editingEntry ? 'Edit Entry' : 'New Diary Entry'}
          </h2>
          <EntryForm
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            initial={editingEntry}
            defaultDate={defaultFormDate}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditingEntry(null) }}
          />
        </div>
      )}

      {view === 'calendar' ? (
        <div className="fade-up" style={{ animationDelay: '80ms', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          {/* Calendar glass card */}
          <div style={{ ...GLASS, padding: 0, overflow: 'hidden' }}>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
              <button
                onClick={prevMonth}
                style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(128,121,111,0.10)', cursor: 'pointer', color: '#80796F', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </button>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 400, color: '#2C2C2A', margin: 0 }}>
                {MONTH_NAMES[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(128,121,111,0.10)', cursor: 'pointer', color: '#80796F', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
              {DAY_LABELS.map((d) => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div style={{ padding: '64px 0', textAlign: 'center', fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Loading…
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.40)', borderRight: '1px solid rgba(255,255,255,0.40)', minHeight: 72, background: 'rgba(255,252,250,0.20)' }} />
                ))}

                {/* Day cells */}
                {Array.from({ length: dim }).map((_, i) => {
                  const d = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const isToday = dateStr === todayStr
                  const isSelected = d === selectedDay
                  const dayEntries = byDay.get(d) ?? []
                  const pending = dayEntries.filter((e) => !e.isCompleted)
                  const done = dayEntries.filter((e) => e.isCompleted)

                  return (
                    <div
                      key={d}
                      onClick={() => setSelectedDay(d === selectedDay ? null : d)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.40)',
                        borderRight: '1px solid rgba(255,255,255,0.40)',
                        minHeight: 72,
                        padding: 6,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(176,139,130,0.12)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,252,250,0.30)' }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{
                          fontFamily: 'var(--font-noto-sans)',
                          fontSize: 12,
                          lineHeight: 1,
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: isToday ? '#B08B82' : 'transparent',
                          color: isToday ? '#ffffff' : '#2C2C2A',
                          fontWeight: isToday ? 600 : 400,
                        }}>
                          {d}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {pending.slice(0, 3).map((e) => (
                          <div key={e.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-noto-sans)', fontSize: 9, lineHeight: 1.4, padding: '1px 4px', borderRadius: 3, background: 'rgba(176,139,130,0.15)', color: 'hsl(10 22% 40%)' }}>
                            {e.title}
                          </div>
                        ))}
                        {done.slice(0, 2).map((e) => (
                          <div key={e.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-noto-sans)', fontSize: 9, lineHeight: 1.4, padding: '1px 4px', borderRadius: 3, background: 'rgba(34,197,94,0.10)', color: 'hsl(142 25% 30%)', textDecoration: 'line-through', opacity: 0.6 }}>
                            {e.title}
                          </div>
                        ))}
                        {dayEntries.length > 3 && (
                          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, color: '#80796F', margin: 0, paddingLeft: 4 }}>+{dayEntries.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Day detail panel — glass card */}
          <div style={{ ...GLASS, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', margin: 0 }}>
                {selectedDay
                  ? `${MONTH_NAMES[month]} ${selectedDay}`
                  : 'Select a day'}
              </p>
            </div>
            <div style={{ padding: 16 }}>
              {!selectedDay ? (
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', textAlign: 'center', padding: '32px 0' }}>
                  Click a day to see entries
                </p>
              ) : selectedEntries.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginBottom: 12 }}>No entries for this day</p>
                  <button
                    onClick={() => { setEditingEntry(null); setShowForm(true) }}
                    style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    + Add entry
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onToggle={handleToggle}
                      onEdit={(e) => { setEditingEntry(e); setShowForm(false) }}
                      onDelete={handleDelete}
                    />
                  ))}
                  <button
                    onClick={() => { setEditingEntry(null); setShowForm(true) }}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: '1px dashed rgba(128,121,111,0.35)',
                      background: 'transparent',
                      fontFamily: 'var(--font-noto-sans)',
                      fontSize: 12,
                      color: '#80796F',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#B08B82'; e.currentTarget.style.borderColor = '#B08B82' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#80796F'; e.currentTarget.style.borderColor = 'rgba(128,121,111,0.35)' }}
                  >
                    + Add entry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="fade-up" style={{ animationDelay: '80ms' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <button
              onClick={prevMonth}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(128,121,111,0.10)', cursor: 'pointer', color: '#80796F', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 400, color: '#2C2C2A' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(128,121,111,0.10)', cursor: 'pointer', color: '#80796F', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {loading ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: '64px 24px' }}>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Loading…</p>
            </div>
          ) : entries.length === 0 ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: '64px 24px' }}>
              <CalendarDays style={{ width: 36, height: 36, color: '#B08B82', margin: '0 auto 16px' }} strokeWidth={1.5} />
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic', marginBottom: 16 }}>
                No diary entries this month.
              </p>
              <button
                onClick={() => { setEditingEntry(null); setShowForm(true) }}
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  background: '#B08B82',
                  borderRadius: 40,
                  padding: '10px 22px',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
              >
                Add the first entry
              </button>
            </div>
          ) : (
            <div style={GLASS}>
              {Array.from(
                entries
                  .slice()
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .reduce((map, e) => {
                    if (!map.has(e.dueDate)) map.set(e.dueDate, [])
                    map.get(e.dueDate)!.push(e)
                    return map
                  }, new Map<string, DiaryEntry[]>()),
              ).map(([date, dayEntries]) => {
                const d = new Date(date + 'T12:00:00Z')
                const label = d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
                const isToday = date === todayStr
                return (
                  <Fragment key={date}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        fontWeight: 400,
                        color: isToday ? '#B08B82' : '#2C2C2A',
                      }}>
                        {label}{isToday ? ' — Today' : ''}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(128,121,111,0.15)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {dayEntries.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          onToggle={handleToggle}
                          onEdit={(e) => { setEditingEntry(e); setShowForm(false) }}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
