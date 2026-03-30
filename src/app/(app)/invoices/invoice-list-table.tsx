'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge'
import { formatCurrency } from '@/lib/utils'

interface InvoiceRow {
  id: string
  invoiceNumber: string
  invoiceType: string
  status: string
  invoiceDate: string
  clientName: string
  matterCode: string
  matterDescription: string
  subTotalCents: number
  vatCents: number
  totalCents: number
  sentAt: string | null
  paidAt: string | null
}

type SortKey = 'invoiceNumber' | 'matterDescription' | 'invoiceDate' | 'totalCents' | 'status'

const COL_STORAGE_KEY = 'invoices-col-widths'
const DEFAULT_WIDTHS: Record<string, number> = {
  invoiceNumber: 140,
  matterDescription: 280,
  invoiceDate: 120,
  totalCents: 140,
  status: 140,
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function loadWidths(): Record<string, number> {
  if (typeof window === 'undefined') return DEFAULT_WIDTHS
  try {
    const stored = localStorage.getItem(COL_STORAGE_KEY)
    if (stored) return { ...DEFAULT_WIDTHS, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return DEFAULT_WIDTHS
}

export function InvoiceListTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>('invoiceDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadWidths)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null)

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
      else setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIcon(col: SortKey) {
    if (sortKey === col) return <span style={{ marginLeft: 4, fontSize: 10, color: '#B08B82' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    if (hoveredCol === col) return <span style={{ marginLeft: 4, fontSize: 10, color: 'rgba(176,139,130,0.5)' }}>↕</span>
    return null
  }

  function resizeHandle(col: string) {
    return (
      <span
        onMouseDown={(e) => startResize(col, e)}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 1, background: 'transparent' }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  const sorted = sortKey ? [...invoices].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'invoiceNumber') cmp = a.invoiceNumber.localeCompare(b.invoiceNumber)
    else if (sortKey === 'matterDescription') cmp = a.matterDescription.localeCompare(b.matterDescription)
    else if (sortKey === 'invoiceDate') cmp = a.invoiceDate.localeCompare(b.invoiceDate)
    else if (sortKey === 'totalCents') cmp = a.totalCents - b.totalCents
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    return sortDir === 'asc' ? cmp : -cmp
  }) : invoices

  const thStyle = (col: string, width: number, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    width,
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...extra,
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="brand-table" style={{ width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: colWidths.invoiceNumber }} />
          <col />
          <col style={{ width: colWidths.invoiceDate }} />
          <col style={{ width: colWidths.totalCents }} />
          <col style={{ width: colWidths.status }} />
        </colgroup>
        <thead>
          <tr>
            <th
              style={thStyle('invoiceNumber', colWidths.invoiceNumber)}
              onClick={() => handleSort('invoiceNumber')}
              onMouseEnter={() => setHoveredCol('invoiceNumber')}
              onMouseLeave={() => setHoveredCol(null)}
            >
              Invoice{sortIcon('invoiceNumber')}
              {resizeHandle('invoiceNumber')}
            </th>
            <th
              style={{ position: 'relative', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('matterDescription')}
              onMouseEnter={() => setHoveredCol('matterDescription')}
              onMouseLeave={() => setHoveredCol(null)}
            >
              Matter / Client{sortIcon('matterDescription')}
              {resizeHandle('matterDescription')}
            </th>
            <th
              style={thStyle('invoiceDate', colWidths.invoiceDate)}
              onClick={() => handleSort('invoiceDate')}
              onMouseEnter={() => setHoveredCol('invoiceDate')}
              onMouseLeave={() => setHoveredCol(null)}
            >
              Date{sortIcon('invoiceDate')}
              {resizeHandle('invoiceDate')}
            </th>
            <th
              style={thStyle('totalCents', colWidths.totalCents, { textAlign: 'right' })}
              onClick={() => handleSort('totalCents')}
              onMouseEnter={() => setHoveredCol('totalCents')}
              onMouseLeave={() => setHoveredCol(null)}
            >
              Amount{sortIcon('totalCents')}
              {resizeHandle('totalCents')}
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
          </tr>
        </thead>
        <tbody>
          {sorted.map((inv) => (
            <tr key={inv.id} style={{ cursor: 'pointer' }}>
              <td style={{ padding: '12px 16px' }}>
                <Link href={`/invoices/${inv.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82', display: 'block' }}>{inv.invoiceNumber}</span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#80796F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {inv.invoiceType === 'pro_forma' ? 'Pro Forma' : 'Invoice'}
                  </span>
                </Link>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <Link href={`/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.matterDescription}</span>
                  <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                    <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11 }}>{inv.matterCode}</span>
                    {' — '}{inv.clientName}
                  </span>
                </Link>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                <Link href={`/invoices/${inv.id}`} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', textDecoration: 'none' }}>
                  {fmtDate(inv.invoiceDate)}
                </Link>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <Link href={`/invoices/${inv.id}`} style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#B08B82', textDecoration: 'none' }}>
                  {formatCurrency(inv.totalCents)}
                </Link>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <InvoiceStatusBadge status={inv.status} invoiceType={inv.invoiceType} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
