'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface TrialBalanceRow {
  code: string
  name: string
  accountType: string
  totalDebitCents: number
  totalCreditCents: number
  balanceCents: number
}

interface TrialBalanceData {
  rows: TrialBalanceRow[]
  grandTotalDebitCents: number
  grandTotalCreditCents: number
}

export function TrialBalance() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<TrialBalanceData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/gl/trial-balance?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Trial Balance',
        rows: data.rows.map((r) => ({
          Code: r.code,
          Account: r.name,
          Type: r.accountType,
          'Debit (R)': (r.totalDebitCents / 100).toFixed(2),
          'Credit (R)': (r.totalCreditCents / 100).toFixed(2),
          'Balance (R)': (r.balanceCents / 100).toFixed(2),
        })),
      }],
      `Trial Balance${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Trial Balance" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Code</th>
            <th className={thCls}>Account</th>
            <th className={thCls}>Type</th>
            <th className={thRCls}>Debit</th>
            <th className={thRCls}>Credit</th>
            <th className={thRCls}>Balance</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.rows.map((r) => (
              <tr key={r.code} className="hover:bg-muted/10">
                <td className={tdMCls + ' text-muted-foreground'}>{r.code}</td>
                <td className={tdCls}>{r.name}</td>
                <td className={tdCls + ' text-muted-foreground capitalize'}>{r.accountType}</td>
                <td className={tdRCls}>{r.totalDebitCents ? formatCurrency(r.totalDebitCents) : '—'}</td>
                <td className={tdRCls}>{r.totalCreditCents ? formatCurrency(r.totalCreditCents) : '—'}</td>
                <td className={tdRCls + ' font-semibold'} style={{ color: r.balanceCents < 0 ? '#ef4444' : 'inherit' }}>
                  {formatCurrency(Math.abs(r.balanceCents))}{r.balanceCents < 0 ? ' Cr' : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <TFoot>
            <td className={tdCls + ' font-semibold'} colSpan={3}>Totals</td>
            <td className={tdRCls + ' font-bold'}>{formatCurrency(data.grandTotalDebitCents)}</td>
            <td className={tdRCls + ' font-bold'}>{formatCurrency(data.grandTotalCreditCents)}</td>
            <td />
          </TFoot>
        </TableWrapper>
      )}
    </>
  )
}
