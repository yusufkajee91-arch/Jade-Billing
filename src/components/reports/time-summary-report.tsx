'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, fmtHours,
  inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface TimeEntry {
  id: string
  entryDate: string
  entryType: string
  narration: string
  durationMinutesBilled: number | null
  totalCents: number
  isBillable: boolean
  isInvoiced: boolean
  matterCode: string
  clientName: string
  earnerInitials: string
}

interface FeeEarnerOption {
  id: string
  firstName: string
  lastName: string
  initials: string
}

interface TimeSummaryData {
  entries: TimeEntry[]
  totals: { totalMinutes: number; totalCents: number; billableMinutes: number; billableCents: number }
  feeEarners: FeeEarnerOption[]
}

export function TimeSummary({ isAdmin }: { isAdmin: boolean }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [earnerId, setEarnerId] = useState('')
  const [data, setData] = useState<TimeSummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (earnerId) p.set('earnerId', earnerId)
    const res = await fetch(`/api/reports/time-summary?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to, earnerId])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Time Recording',
        rows: data.entries.map((e) => ({
          Date: String(e.entryDate).slice(0, 10),
          Matter: e.matterCode,
          Client: e.clientName,
          Description: e.narration,
          Earner: e.earnerInitials,
          Time: e.durationMinutesBilled ? fmtHours(e.durationMinutesBilled) : '',
          'Value (R)': (e.totalCents / 100).toFixed(2),
          Status: e.isInvoiced ? 'Invoiced' : e.isBillable ? 'WIP' : 'Non-billable',
        })),
      }],
      `Time Recording${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Time Recording Summary" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        {isAdmin && data?.feeEarners && (
          <FilterField label="Fee Earner">
            <select className={inputCls} value={earnerId} onChange={(e) => setEarnerId(e.target.value)}>
              <option value="">All Earners</option>
              {data.feeEarners.map((u) => (
                <option key={u.id} value={u.id}>{u.initials} — {u.firstName} {u.lastName}</option>
              ))}
            </select>
          </FilterField>
        )}
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : data.entries.length === 0 ? (
        <EmptyState message="No time entries for this period" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Time', value: fmtHours(data.totals.totalMinutes) },
              { label: 'Billable Time', value: fmtHours(data.totals.billableMinutes) },
              { label: 'Total Value', value: formatCurrency(data.totals.totalCents) },
              { label: 'Billable Value', value: formatCurrency(data.totals.billableCents) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border p-4">
                <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">{kpi.label}</p>
                <p className="font-sans text-xl font-semibold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>
          <TableWrapper>
            <THead>
              <th className={thCls}>Date</th>
              <th className={thCls}>Matter</th>
              <th className={thCls}>Client</th>
              <th className={thCls}>Description</th>
              {isAdmin && <th className={thCls}>Earner</th>}
              <th className={thRCls}>Time</th>
              <th className={thRCls}>Value</th>
              <th className={thCls}>Status</th>
            </THead>
            <tbody className="divide-y divide-border">
              {data.entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/10">
                  <td className={tdCls + ' text-muted-foreground whitespace-nowrap'}>{formatDate(e.entryDate)}</td>
                  <td className={tdMCls + ' text-muted-foreground'}>{e.matterCode}</td>
                  <td className={tdCls}>{e.clientName}</td>
                  <td className={tdCls + ' text-muted-foreground max-w-xs truncate'}>{e.narration}</td>
                  {isAdmin && <td className={tdMCls + ' text-muted-foreground'}>{e.earnerInitials}</td>}
                  <td className={tdRCls + ' text-muted-foreground'}>{e.durationMinutesBilled ? fmtHours(e.durationMinutesBilled) : '—'}</td>
                  <td className={tdRCls}>{formatCurrency(e.totalCents)}</td>
                  <td className={tdCls}>
                    {e.isInvoiced ? (
                      <span className="font-sans text-[11px] text-[#22c55e]">Invoiced</span>
                    ) : e.isBillable ? (
                      <span className="font-sans text-[11px] text-[#f59e0b]">WIP</span>
                    ) : (
                      <span className="font-sans text-[11px] text-muted-foreground">Non-billable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </>
      )}
    </>
  )
}
