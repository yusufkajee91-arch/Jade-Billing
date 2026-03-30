'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, ACCENT, fmtHours,
  inputCls, thCls, thRCls, tdCls, tdRCls,
} from './report-helpers'

interface EarnerRow {
  userId: string
  name: string
  initials: string
  totalMinutes: number
  recordedCents: number
  billedCents: number
  unbilledCents: number
  entryCount: number
}

interface FeePerformanceData {
  earners: EarnerRow[]
}

export function FeePerformance() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<FeePerformanceData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/reports/fee-earner-performance?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Fee Earner Performance',
        rows: data.earners.map((e) => {
          const pct = e.recordedCents > 0 ? Math.round((e.billedCents / e.recordedCents) * 100) : 0
          return {
            Initials: e.initials,
            'Fee Earner': e.name,
            'Time Recorded': e.totalMinutes ? fmtHours(e.totalMinutes) : '',
            'Fees Recorded (R)': (e.recordedCents / 100).toFixed(2),
            'Billed (R)': (e.billedCents / 100).toFixed(2),
            'WIP (R)': (e.unbilledCents / 100).toFixed(2),
            'Billed %': `${pct}%`,
          }
        }),
      }],
      `Fee Earner Performance${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Fee Earner Performance" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : data.earners.length === 0 ? (
        <EmptyState message="No fee entries for this period" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Fee Earner</th>
            <th className={thRCls}>Time Recorded</th>
            <th className={thRCls}>Fees Recorded</th>
            <th className={thRCls}>Billed</th>
            <th className={thRCls}>WIP</th>
            <th className={thRCls}>Billed %</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.earners.map((e) => {
              const pct = e.recordedCents > 0 ? Math.round((e.billedCents / e.recordedCents) * 100) : 0
              return (
                <tr key={e.userId} className="hover:bg-muted/10">
                  <td className={tdCls}>
                    <span className="font-sans text-xs text-muted-foreground mr-2">{e.initials}</span>
                    {e.name}
                  </td>
                  <td className={tdRCls + ' text-muted-foreground'}>{e.totalMinutes ? fmtHours(e.totalMinutes) : '—'}</td>
                  <td className={tdRCls + ' font-semibold'} style={{ color: ACCENT }}>{formatCurrency(e.recordedCents)}</td>
                  <td className={tdRCls} style={{ color: '#22c55e' }}>{formatCurrency(e.billedCents)}</td>
                  <td className={tdRCls} style={{ color: '#f59e0b' }}>{formatCurrency(e.unbilledCents)}</td>
                  <td className={tdRCls}>
                    <span className="font-sans text-sm" style={{ color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {pct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrapper>
      )}
    </>
  )
}
