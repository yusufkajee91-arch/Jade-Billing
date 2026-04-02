'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MatterStatusBadge } from '@/components/ui/matter-status-badge'
import { MatterForm } from '@/components/matters/matter-form'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('MattersView')

interface MatterListItem {
  id: string
  matterCode: string
  description: string
  status: string
  dateOpened: string
  client: { id: string; clientCode: string; clientName: string }
  owner: { id: string; firstName: string; lastName: string; initials: string }
  matterType: { id: string; name: string } | null
}

type SortKey = 'matterCode' | 'clientName' | 'description' | 'matterType' | 'status' | 'owner' | 'dateOpened'

const COL_STORAGE_KEY = 'matters-col-widths'
const DEFAULT_WIDTHS: Record<string, number> = {
  matterCode: 160,
  client: 220,
  description: 260,
  matterType: 120,
  status: 110,
  owner: 160,
  dateOpened: 120,
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

function loadWidths(): Record<string, number> {
  if (typeof window === 'undefined') return DEFAULT_WIDTHS
  try {
    const stored = localStorage.getItem(COL_STORAGE_KEY)
    if (stored) return { ...DEFAULT_WIDTHS, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return DEFAULT_WIDTHS
}

export function MattersView() {
  log.info('render')
  const router = useRouter()
  const [matters, setMatters] = useState<MatterListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>('dateOpened')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadWidths)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null)

  const fetchMatters = useCallback(async () => {
    log.info('fetching matters', { statusFilter })
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/matters?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      log.info('matters loaded', { count: data.length })
      setMatters(data)
    } catch (err) {
      log.error('failed to load matters', err)
      toast.error('Failed to load matters')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchMatters() }, [fetchMatters])

  // Column resize handlers
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const { col, startX, startW } = resizingRef.current
      const delta = e.clientX - startX
      const newW = Math.max(80, startW + delta)
      setColWidths((prev) => {
        const next = { ...prev, [col]: newW }
        try { localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }
    function onMouseUp() { resizingRef.current = null }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function startResize(col: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] ?? DEFAULT_WIDTHS[col] ?? 120 }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortKey(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIcon(col: SortKey) {
    const isActive = sortKey === col
    const isHovered = hoveredCol === col
    if (isActive) return <span style={{ marginLeft: 4, fontSize: 10, color: '#B08B82' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    if (isHovered) return <span style={{ marginLeft: 4, fontSize: 10, color: 'rgba(176,139,130,0.5)' }}>↕</span>
    return null
  }

  function resizeHandle(col: string) {
    return (
      <span
        onMouseDown={(e) => startResize(col, e)}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 1,
          background: 'transparent',
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  const filtered = matters.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.matterCode.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.client.clientName.toLowerCase().includes(q) ||
      m.client.clientCode.toLowerCase().includes(q)
    )
  })

  const sorted = sortKey ? [...filtered].sort((a, b) => {
    let av = '', bv = ''
    if (sortKey === 'matterCode') { av = a.matterCode; bv = b.matterCode }
    else if (sortKey === 'clientName') { av = a.client.clientName; bv = b.client.clientName }
    else if (sortKey === 'description') { av = a.description; bv = b.description }
    else if (sortKey === 'matterType') { av = a.matterType?.name ?? ''; bv = b.matterType?.name ?? '' }
    else if (sortKey === 'status') { av = a.status; bv = b.status }
    else if (sortKey === 'owner') { av = `${a.owner.lastName}${a.owner.firstName}`; bv = `${b.owner.lastName}${b.owner.firstName}` }
    else if (sortKey === 'dateOpened') { av = a.dateOpened; bv = b.dateOpened }
    const cmp = av.localeCompare(bv)
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const thStyle = (col: SortKey, width: number): React.CSSProperties => ({
    position: 'relative',
    width,
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    fontFamily: 'var(--font-noto-sans)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
    color: '#80796F',
    borderBottom: '1px solid #D8D3CB',
    textAlign: 'left',
  })

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* ─── Dark header bar ─────────────────────────────────────────────────── */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Practice
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Matters
          </h1>
        </div>
        <button
          onClick={() => { log.info('opening create matter form'); setSheetOpen(true) }}
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
            gap: 8,
            transition: 'background 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#93706A')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#B08B82')}
        >
          <Plus style={{ width: 14, height: 14 }} />
          New Matter
        </button>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          placeholder="Search matters, clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, background: 'rgba(255,252,250,0.7)', border: '1px solid #D8D3CB', borderRadius: 8, fontFamily: 'var(--font-noto-sans)', fontSize: 14 }}
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 176, background: 'rgba(255,252,250,0.7)', border: '1px solid #D8D3CB', borderRadius: 8 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ───────────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brand-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: colWidths.matterCode }} />
              <col style={{ width: colWidths.client }} />
              <col />
              <col style={{ width: colWidths.matterType }} />
              <col style={{ width: colWidths.status }} />
              <col style={{ width: colWidths.owner }} />
              <col style={{ width: colWidths.dateOpened }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={thStyle('matterCode', colWidths.matterCode)}
                  onClick={() => handleSort('matterCode')}
                  onMouseEnter={() => setHoveredCol('matterCode')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Matter Code{sortIcon('matterCode')}
                  {resizeHandle('matterCode')}
                </th>
                <th
                  style={thStyle('clientName', colWidths.client)}
                  onClick={() => handleSort('clientName')}
                  onMouseEnter={() => setHoveredCol('clientName')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Client{sortIcon('clientName')}
                  {resizeHandle('client')}
                </th>
                <th
                  style={{ position: 'relative', padding: '12px 16px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'visible', fontFamily: 'var(--font-noto-sans)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#80796F', borderBottom: '1px solid #D8D3CB', textAlign: 'left' }}
                  onClick={() => handleSort('description')}
                  onMouseEnter={() => setHoveredCol('description')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Description{sortIcon('description')}
                  {resizeHandle('description')}
                </th>
                <th
                  style={thStyle('matterType', colWidths.matterType)}
                  onClick={() => handleSort('matterType')}
                  onMouseEnter={() => setHoveredCol('matterType')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Type{sortIcon('matterType')}
                  {resizeHandle('matterType')}
                </th>
                <th
                  style={thStyle('status', colWidths.status)}
                  onClick={() => handleSort('status')}
                  onMouseEnter={() => setHoveredCol('status')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Status{sortIcon('status')}
                  {resizeHandle('status')}
                </th>
                <th
                  style={thStyle('owner', colWidths.owner)}
                  onClick={() => handleSort('owner')}
                  onMouseEnter={() => setHoveredCol('owner')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Owner{sortIcon('owner')}
                  {resizeHandle('owner')}
                </th>
                <th
                  style={thStyle('dateOpened', colWidths.dateOpened)}
                  onClick={() => handleSort('dateOpened')}
                  onMouseEnter={() => setHoveredCol('dateOpened')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Opened{sortIcon('dateOpened')}
                  {resizeHandle('dateOpened')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7}>
                      <div style={{ height: 16, background: 'rgba(216,211,203,0.4)', borderRadius: 4 }} className="animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 56 }}>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>
                      {matters.length === 0 ? 'No matters yet — create your first.' : 'No matters match your search.'}
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((matter) => (
                  <tr
                    key={matter.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/matters/${matter.id}`)}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82' }}>
                        {matter.matterCode}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', display: 'block', marginBottom: 2 }}>
                        {matter.client.clientCode}
                      </span>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36' }}>{matter.client.clientName}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {matter.description.length > 60 ? matter.description.slice(0, 60) + '…' : matter.description}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#80796F', fontSize: 13 }}>
                        {matter.matterType?.name ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <MatterStatusBadge status={matter.status} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F' }}>{matter.owner.initials}</span>
                        <span style={{ color: '#80796F', fontSize: 13 }}>{matter.owner.firstName} {matter.owner.lastName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#80796F', fontSize: 13 }}>
                        {formatDate(matter.dateOpened)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">New Matter</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <MatterForm
              onClose={() => setSheetOpen(false)}
              onSaved={(id) => {
                setSheetOpen(false)
                router.push(`/matters/${id}`)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
