'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface TrustMatter {
  matterId: string
  matterCode: string
  description: string
  clientName: string
  balanceCents: number
  lastEntryDate: string | null
}

interface TrustRegisterData {
  matters: TrustMatter[]
  totalBalanceCents: number
}

export function TrustInvestmentsReport() {
  const [asAt, setAsAt] = useState('')
  const [data, setData] = useState<TrustRegisterData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (asAt) p.set('asAt', asAt)
    const res = await fetch(`/api/trust-register?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [asAt])

  const handleExport = () => {
    if (!data) return

    const mattersSheet = {
      name: 'Trust Balances',
      rows: data.matters.map((m) => ({
        'Matter Code': m.matterCode,
        Description: m.description,
        Client: m.clientName,
        'Last Activity': m.lastEntryDate ? String(m.lastEntryDate).slice(0, 10) : '',
        'Balance (R)': (m.balanceCents / 100).toFixed(2),
      })),
    }

    const summarySheet = {
      name: 'Summary',
      rows: [
        { 'Report': 'Trust & Investments', 'As At': asAt || 'Current', 'Total Trust Balance (R)': (data.totalBalanceCents / 100).toFixed(2) },
      ],
    }

    exportToExcel(
      [mattersSheet, summarySheet],
      `Trust & Investments${asAt ? ` as at ${asAt}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Trust & Investments" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="As At">
          <input type="date" className={inputCls} value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        </FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Run the report to see trust balances" />
      ) : data.matters.length === 0 ? (
        <EmptyState message="No trust entries recorded" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Matter</th>
            <th className={thCls}>Description</th>
            <th className={thCls}>Client</th>
            <th className={thCls}>Last Activity</th>
            <th className={thRCls}>Balance</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.matters.map((m) => (
              <tr key={m.matterId} className="hover:bg-muted/10">
                <td className={tdMCls + ' text-muted-foreground'}>{m.matterCode}</td>
                <td className={tdCls}>{m.description}</td>
                <td className={tdCls}>{m.clientName}</td>
                <td className={tdCls + ' text-muted-foreground'}>{m.lastEntryDate ? formatDate(m.lastEntryDate) : '—'}</td>
                <td className={tdRCls + ' font-semibold'} style={{ color: m.balanceCents < 0 ? '#ef4444' : ACCENT }}>
                  {formatCurrency(m.balanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <TFoot>
            <td className={tdCls + ' font-semibold'} colSpan={4}>Total{asAt ? ` as at ${asAt}` : ''}</td>
            <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(data.totalBalanceCents)}</td>
          </TFoot>
        </TableWrapper>
      )}
    </>
  )
}
