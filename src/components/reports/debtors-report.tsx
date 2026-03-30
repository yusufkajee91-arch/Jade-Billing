'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, thCls, thRCls, tdCls, tdRCls,
} from './report-helpers'

interface DebtorRow {
  clientId: string
  clientName: string
  currentCents: number
  thirtyCents: number
  sixtyCents: number
  ninetyCents: number
  totalCents: number
}

interface DebtorsData {
  debtors: DebtorRow[]
  grandTotal: number
}

export function DebtorsReport() {
  const [data, setData] = useState<DebtorsData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/debtors')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Debtors Age Analysis',
        rows: data.debtors.map((d) => ({
          Client: d.clientName,
          'Current 0-30d (R)': (d.currentCents / 100).toFixed(2),
          '31-60 Days (R)': (d.thirtyCents / 100).toFixed(2),
          '61-90 Days (R)': (d.sixtyCents / 100).toFixed(2),
          '91+ Days (R)': (d.ninetyCents / 100).toFixed(2),
          'Total (R)': (d.totalCents / 100).toFixed(2),
        })),
      }],
      'Debtors Age Analysis'
    )
  }

  return (
    <>
      <ReportHeader title="Debtors Age Analysis" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Run the report to see outstanding debtors" />
      ) : data.debtors.length === 0 ? (
        <EmptyState message="No outstanding invoices — all clients are settled" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Client</th>
            <th className={thRCls}>Current (0–30d)</th>
            <th className={thRCls}>31–60 days</th>
            <th className={thRCls}>61–90 days</th>
            <th className={thRCls}>91+ days</th>
            <th className={thRCls}>Total</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.debtors.map((d) => (
              <tr key={d.clientId} className="hover:bg-muted/10">
                <td className={tdCls + ' font-medium'}>{d.clientName}</td>
                <td className={tdRCls} style={{ color: d.currentCents ? '#22c55e' : undefined }}>{d.currentCents ? formatCurrency(d.currentCents) : '—'}</td>
                <td className={tdRCls} style={{ color: d.thirtyCents ? '#f59e0b' : undefined }}>{d.thirtyCents ? formatCurrency(d.thirtyCents) : '—'}</td>
                <td className={tdRCls} style={{ color: d.sixtyCents ? '#f97316' : undefined }}>{d.sixtyCents ? formatCurrency(d.sixtyCents) : '—'}</td>
                <td className={tdRCls} style={{ color: d.ninetyCents ? '#ef4444' : undefined }}>{d.ninetyCents ? formatCurrency(d.ninetyCents) : '—'}</td>
                <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(d.totalCents)}</td>
              </tr>
            ))}
          </tbody>
          <TFoot>
            <td className={tdCls + ' font-semibold'}>Total</td>
            <td colSpan={4} />
            <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(data.grandTotal)}</td>
          </TFoot>
        </TableWrapper>
      )}
    </>
  )
}
