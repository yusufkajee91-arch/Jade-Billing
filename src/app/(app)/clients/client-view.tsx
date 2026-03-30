'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
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
import { FicaBadge } from '@/components/ui/fica-badge'
import { ClientForm } from '@/components/clients/client-form'
import { formatEntityType } from '@/lib/entity-types'

interface ClientListItem {
  id: string
  clientCode: string
  clientName: string
  entityType: string
  ficaStatus: string
  isActive: boolean
  createdAt: string
  emailGeneral: string | null
  emailInvoices: string | null
  tel: string | null
  mobile: string | null
  _count: { matters: number }
}

type SortKey = 'clientCode' | 'clientName' | 'entityType' | 'ficaStatus' | 'matters'

const COL_STORAGE_KEY = 'clients-col-widths'
const DEFAULT_WIDTHS: Record<string, number> = {
  clientCode: 120,
  clientName: 240,
  entityType: 160,
  ficaStatus: 140,
  matters: 120,
  actions: 100,
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

export function ClientsView() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>('clientName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadWidths)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null)

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeFilter !== 'all') params.set('active', activeFilter === 'active' ? 'true' : 'false')
      const res = await fetch(`/api/clients?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load clients')
      }
      setClients(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => { fetchClients() }, [fetchClients])

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

  const filtered = clients.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.clientCode.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q)
    )
  })

  const sorted = sortKey ? [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'clientCode') cmp = a.clientCode.localeCompare(b.clientCode)
    else if (sortKey === 'clientName') cmp = a.clientName.localeCompare(b.clientName)
    else if (sortKey === 'entityType') cmp = a.entityType.localeCompare(b.entityType)
    else if (sortKey === 'ficaStatus') cmp = a.ficaStatus.localeCompare(b.ficaStatus)
    else if (sortKey === 'matters') cmp = a._count.matters - b._count.matters
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const thStyle = (col: SortKey, width: number): React.CSSProperties => ({
    position: 'relative',
    width,
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  })

  const openCreate = () => {
    setEditingClient(null)
    setSheetOpen(true)
  }

  const openEdit = (client: ClientListItem) => {
    setEditingClient(client)
    setSheetOpen(true)
  }

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* ─── Dark header bar ─────────────────────────────────────────────────── */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Practice
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Clients
          </h1>
        </div>
        <button
          onClick={openCreate}
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
          New Client
        </button>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, background: 'rgba(255,252,250,0.7)', border: '1px solid #D8D3CB', borderRadius: 8, fontFamily: 'var(--font-noto-sans)', fontSize: 14 }}
        />
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 176, background: 'rgba(255,252,250,0.7)', border: '1px solid #D8D3CB', borderRadius: 8 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ───────────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brand-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: colWidths.clientCode }} />
              <col />
              <col style={{ width: colWidths.entityType }} />
              <col style={{ width: colWidths.ficaStatus }} />
              <col style={{ width: colWidths.matters }} />
              <col style={{ width: colWidths.actions }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={thStyle('clientCode', colWidths.clientCode)}
                  onClick={() => handleSort('clientCode')}
                  onMouseEnter={() => setHoveredCol('clientCode')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Client Code{sortIcon('clientCode')}
                  {resizeHandle('clientCode')}
                </th>
                <th
                  style={{ position: 'relative', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('clientName')}
                  onMouseEnter={() => setHoveredCol('clientName')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Client Name{sortIcon('clientName')}
                  {resizeHandle('clientName')}
                </th>
                <th
                  style={thStyle('entityType', colWidths.entityType)}
                  onClick={() => handleSort('entityType')}
                  onMouseEnter={() => setHoveredCol('entityType')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Entity Type{sortIcon('entityType')}
                  {resizeHandle('entityType')}
                </th>
                <th
                  style={thStyle('ficaStatus', colWidths.ficaStatus)}
                  onClick={() => handleSort('ficaStatus')}
                  onMouseEnter={() => setHoveredCol('ficaStatus')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  FICA Status{sortIcon('ficaStatus')}
                  {resizeHandle('ficaStatus')}
                </th>
                <th
                  style={thStyle('matters', colWidths.matters)}
                  onClick={() => handleSort('matters')}
                  onMouseEnter={() => setHoveredCol('matters')}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  Active Matters{sortIcon('matters')}
                  {resizeHandle('matters')}
                </th>
                <th style={{ position: 'relative', width: colWidths.actions, padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div style={{ height: 16, background: 'rgba(216,211,203,0.4)', borderRadius: 4 }} className="animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 56 }}>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>
                      {clients.length === 0 ? 'No clients yet — add your first.' : 'No clients match your search.'}
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((client) => (
                  <tr key={client.id}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                        {client.clientCode}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => router.push(`/clients/${client.id}`)}
                        style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      >
                        {client.clientName}
                        {!client.isActive && (
                          <span style={{ marginLeft: 8, fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F' }}>(Inactive)</span>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#80796F', fontSize: 13 }}>
                        {formatEntityType(client.entityType)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <FicaBadge status={client.ficaStatus} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                        {client._count.matters}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => router.push(`/clients/${client.id}`)}
                          style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEdit(client)}
                          style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#80796F', display: 'flex', alignItems: 'center' }}
                          aria-label={`Edit ${client.clientName}`}
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
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
            <SheetTitle className="font-serif text-xl font-light">
              {editingClient ? 'Edit Client' : 'New Client'}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ClientForm
              key={editingClient?.id ?? 'new'}
              client={editingClient}
              onClose={() => setSheetOpen(false)}
              onSaved={fetchClients}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
