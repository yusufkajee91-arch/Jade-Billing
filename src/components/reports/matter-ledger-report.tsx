'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface LedgerEntry {
  id: string
  date: string
  entryType: string
  narration: string
  referenceNumber: string | null
  debitCents: number
  creditCents: number
  balanceCents: number
}

interface LedgerMatter {
  id: string
  matterCode: string
  description: string
  client: { clientCode: string; clientName: string }
}

interface LedgerData {
  matter: LedgerMatter
  openingBalanceCents: number
  closingBalanceCents: number
  entries: LedgerEntry[]
}

interface MatterOption {
  id: string
  matterCode: string
  description: string
  client: { clientName: string }
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  trust_receipt: 'Trust Receipt',
  trust_payment: 'Trust Payment',
  trust_transfer_in: 'Transfer In',
  trust_transfer_out: 'Transfer Out',
  collection_receipt: 'Collection Receipt',
}

export function MatterLedgerReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [matterId, setMatterId] = useState('')
  const [matterSearch, setMatterSearch] = useState('')
  const [matterOptions, setMatterOptions] = useState<MatterOption[]>([])
  const [selectedMatter, setSelectedMatter] = useState<MatterOption | null>(null)
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const searchMatters = useCallback(async (q: string) => {
    if (!q.trim()) { setMatterOptions([]); return }
    setSearching(true)
    const res = await fetch(`/api/matters?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      const list = await res.json()
      setMatterOptions(Array.isArray(list) ? list : [])
    }
    setSearching(false)
  }, [])

  const run = useCallback(async () => {
    if (!matterId) return
    setLoading(true)
    const p = new URLSearchParams({ matterId })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/reports/matter-ledger?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [matterId, from, to])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Matter Ledger',
        rows: [
          { Date: '', Type: 'OPENING BALANCE', Narration: '', Reference: '', 'Debit (R)': '', 'Credit (R)': '', 'Balance (R)': (data.openingBalanceCents / 100).toFixed(2) },
          ...data.entries.map((e) => ({
            Date: e.date,
            Type: ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType,
            Narration: e.narration,
            Reference: e.referenceNumber ?? '',
            'Debit (R)': e.debitCents ? (e.debitCents / 100).toFixed(2) : '',
            'Credit (R)': e.creditCents ? (e.creditCents / 100).toFixed(2) : '',
            'Balance (R)': (e.balanceCents / 100).toFixed(2),
          })),
          { Date: '', Type: 'CLOSING BALANCE', Narration: '', Reference: '', 'Debit (R)': '', 'Credit (R)': '', 'Balance (R)': (data.closingBalanceCents / 100).toFixed(2) },
        ],
      }],
      `Trust Ledger ${data.matter.matterCode}${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Matter Trust Ledger" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="Matter">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className={inputCls}
              style={{ minWidth: 260 }}
              value={matterSearch}
              onChange={(e) => {
                setMatterSearch(e.target.value)
                if (!e.target.value) { setMatterId(''); setSelectedMatter(null) }
                searchMatters(e.target.value)
              }}
              placeholder="Search by code or description…"
            />
            {matterOptions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #D8D3CB', borderRadius: 8, boxShadow: '0 8px 24px rgba(74,72,69,0.12)', marginTop: 4, overflow: 'hidden' }}>
                {searching && <p className="px-3 py-2 font-sans text-xs text-muted-foreground">Searching…</p>}
                {matterOptions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMatterId(m.id)
                      setSelectedMatter(m)
                      setMatterSearch(`${m.matterCode} — ${m.description}`)
                      setMatterOptions([])
                    }}
                    className="w-full text-left px-3 py-2 font-sans text-sm hover:bg-muted/30 border-b border-border last:border-0"
                  >
                    <span className="text-xs text-muted-foreground mr-2">{m.matterCode}</span>
                    {m.description}
                    <span className="text-xs text-muted-foreground ml-2">{m.client.clientName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </FilterField>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>

      {!data ? (
        <EmptyState message="Select a matter and run the report" />
      ) : (
        <>
          {/* Matter info */}
          <div className="mb-4 p-4 rounded-lg border border-border bg-muted/10">
            <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-1">Matter</p>
            <p className="font-sans text-sm font-medium">{data.matter.matterCode} — {data.matter.description}</p>
            <p className="font-sans text-xs text-muted-foreground">{data.matter.client.clientName} ({data.matter.client.clientCode})</p>
          </div>

          <TableWrapper>
            <THead>
              <th className={thCls}>Date</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Narration</th>
              <th className={thCls}>Reference</th>
              <th className={thRCls}>Debit (In)</th>
              <th className={thRCls}>Credit (Out)</th>
              <th className={thRCls}>Balance</th>
            </THead>
            <tbody className="divide-y divide-border">
              {/* Opening balance row */}
              <tr className="bg-muted/10">
                <td className={tdMCls + ' text-muted-foreground'} colSpan={6}>Opening Balance</td>
                <td className={tdRCls + ' font-semibold'} style={{ color: ACCENT }}>{formatCurrency(data.openingBalanceCents)}</td>
              </tr>
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 font-sans text-xs text-muted-foreground uppercase tracking-wide">
                    No entries for this period
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/10">
                    <td className={tdCls + ' text-muted-foreground whitespace-nowrap'}>{formatDate(entry.date)}</td>
                    <td className={tdMCls + ' text-muted-foreground'}>{ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}</td>
                    <td className={tdCls}>{entry.narration}</td>
                    <td className={tdMCls + ' text-muted-foreground'}>{entry.referenceNumber ?? '—'}</td>
                    <td className={tdRCls} style={{ color: entry.debitCents ? '#22c55e' : undefined }}>{entry.debitCents ? formatCurrency(entry.debitCents) : '—'}</td>
                    <td className={tdRCls} style={{ color: entry.creditCents ? '#ef4444' : undefined }}>{entry.creditCents ? formatCurrency(entry.creditCents) : '—'}</td>
                    <td className={tdRCls + ' font-semibold'} style={{ color: entry.balanceCents < 0 ? '#ef4444' : ACCENT }}>{formatCurrency(entry.balanceCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <TFoot>
              <td className={tdCls + ' font-semibold'} colSpan={6}>Closing Balance</td>
              <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(data.closingBalanceCents)}</td>
            </TFoot>
          </TableWrapper>
        </>
      )}
    </>
  )
}
