'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface AccountLine {
  code: string
  name: string
  balanceCents: number
}

interface IncomeExpenseData {
  income: AccountLine[]
  expenses: AccountLine[]
  totalIncomeCents: number
  totalExpensesCents: number
  netProfitCents: number
}

export function IncomeExpenseReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<IncomeExpenseData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/reports/income-expense?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'P&L',
        rows: [
          { Section: 'INCOME', Code: '', Account: '', 'Amount (R)': '' },
          ...data.income.map((a) => ({ Section: '', Code: a.code, Account: a.name, 'Amount (R)': (a.balanceCents / 100).toFixed(2) })),
          { Section: 'Total Income', Code: '', Account: '', 'Amount (R)': (data.totalIncomeCents / 100).toFixed(2) },
          { Section: '', Code: '', Account: '', 'Amount (R)': '' },
          { Section: 'EXPENSES', Code: '', Account: '', 'Amount (R)': '' },
          ...data.expenses.map((a) => ({ Section: '', Code: a.code, Account: a.name, 'Amount (R)': (a.balanceCents / 100).toFixed(2) })),
          { Section: 'Total Expenses', Code: '', Account: '', 'Amount (R)': (data.totalExpensesCents / 100).toFixed(2) },
          { Section: '', Code: '', Account: '', 'Amount (R)': '' },
          { Section: 'NET PROFIT / (LOSS)', Code: '', Account: '', 'Amount (R)': (data.netProfitCents / 100).toFixed(2) },
        ],
      }],
      `Income & Expense${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Income & Expense (P&L)" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : (
        <div className="space-y-6">
          {/* Income section */}
          <div>
            <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">Income</p>
            <TableWrapper>
              <THead>
                <th className={thCls}>Code</th>
                <th className={thCls}>Account</th>
                <th className={thRCls}>Amount</th>
              </THead>
              <tbody className="divide-y divide-border">
                {data.income.map((a) => (
                  <tr key={a.code} className="hover:bg-muted/10">
                    <td className={tdMCls + ' text-muted-foreground'}>{a.code}</td>
                    <td className={tdCls}>{a.name}</td>
                    <td className={tdRCls} style={{ color: '#22c55e' }}>{formatCurrency(a.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
              <TFoot>
                <td className={tdCls + ' font-semibold'} colSpan={2}>Total Income</td>
                <td className={tdRCls + ' font-bold'} style={{ color: '#22c55e' }}>{formatCurrency(data.totalIncomeCents)}</td>
              </TFoot>
            </TableWrapper>
          </div>

          {/* Expenses section */}
          <div>
            <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">Expenses</p>
            <TableWrapper>
              <THead>
                <th className={thCls}>Code</th>
                <th className={thCls}>Account</th>
                <th className={thRCls}>Amount</th>
              </THead>
              <tbody className="divide-y divide-border">
                {data.expenses.map((a) => (
                  <tr key={a.code} className="hover:bg-muted/10">
                    <td className={tdMCls + ' text-muted-foreground'}>{a.code}</td>
                    <td className={tdCls}>{a.name}</td>
                    <td className={tdRCls} style={{ color: '#ef4444' }}>{formatCurrency(a.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
              <TFoot>
                <td className={tdCls + ' font-semibold'} colSpan={2}>Total Expenses</td>
                <td className={tdRCls + ' font-bold'} style={{ color: '#ef4444' }}>{formatCurrency(data.totalExpensesCents)}</td>
              </TFoot>
            </TableWrapper>
          </div>

          {/* Net profit */}
          <div className={`rounded-lg border p-4 ${data.netProfitCents >= 0 ? 'border-[#22c55e]/30 bg-[#22c55e]/5' : 'border-[#ef4444]/30 bg-[#ef4444]/5'}`}>
            <div className="flex items-center justify-between">
              <p className="font-sans text-sm font-semibold uppercase tracking-wide">
                Net {data.netProfitCents >= 0 ? 'Profit' : 'Loss'}
              </p>
              <p className="font-serif text-xl font-semibold" style={{ color: data.netProfitCents >= 0 ? '#22c55e' : '#ef4444' }}>
                {formatCurrency(Math.abs(data.netProfitCents))}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
