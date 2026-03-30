'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, fmtHours,
  thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface WipMatter {
  matterId: string
  matterCode: string
  description: string
  clientName: string
  entryCount: number
  totalMinutes: number
  totalCents: number
}

interface WipData {
  matters: WipMatter[]
  grandTotalCents: number
  grandTotalMinutes: number
}

export function WipReport() {
  const [data, setData] = useState<WipData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/reports/wip')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'WIP Report',
        rows: data.matters.map((m) => ({
          Matter: m.matterCode,
          Description: m.description,
          Client: m.clientName,
          Entries: m.entryCount,
          Time: m.totalMinutes ? fmtHours(m.totalMinutes) : '',
          'Value (R)': (m.totalCents / 100).toFixed(2),
        })),
      }],
      'WIP Report'
    )
  }

  return (
    <>
      <ReportHeader title="WIP Report" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Run the report to see unbilled work in progress" />
      ) : data.matters.length === 0 ? (
        <EmptyState message="No unbilled work in progress" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Matter</th>
            <th className={thCls}>Description</th>
            <th className={thCls}>Client</th>
            <th className={thRCls}>Entries</th>
            <th className={thRCls}>Time</th>
            <th className={thRCls}>Value</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.matters.map((m) => (
              <tr key={m.matterId} className="hover:bg-muted/10">
                <td className={tdMCls + ' text-muted-foreground'}>{m.matterCode}</td>
                <td className={tdCls}>{m.description}</td>
                <td className={tdCls}>{m.clientName}</td>
                <td className={tdRCls + ' text-muted-foreground'}>{m.entryCount}</td>
                <td className={tdRCls + ' text-muted-foreground'}>{m.totalMinutes ? fmtHours(m.totalMinutes) : '—'}</td>
                <td className={tdRCls + ' font-semibold'} style={{ color: ACCENT }}>{formatCurrency(m.totalCents)}</td>
              </tr>
            ))}
          </tbody>
          <TFoot>
            <td className={tdCls + ' font-semibold'} colSpan={3}>Total</td>
            <td className={tdRCls + ' text-muted-foreground'}></td>
            <td className={tdRCls + ' font-bold text-muted-foreground'}>{fmtHours(data.grandTotalMinutes)}</td>
            <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(data.grandTotalCents)}</td>
          </TFoot>
        </TableWrapper>
      )}
    </>
  )
}
