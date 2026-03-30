'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, inputCls, thCls, thRCls, tdCls, tdRCls,
} from './report-helpers'

interface BankStatement {
  id: string
  fileName: string
  accountType: string
  accountNumber: string | null
  statementFrom: string | null
  statementTo: string | null
  importedAt: string
}

interface ReconLine {
  id: string
  transactionDate: string
  description: string
  amountCents: number
  balanceCents: number
  isReconciled: boolean
  matches: { id: string }[]
}

interface ReconReport {
  statement: BankStatement
  summary: {
    totalLines: number
    matchedLines: number
    unmatchedLines: number
    adjustedBankBalance: number
    trustControlBalanceCents: number | null
    isBalanced: boolean | null
  }
  lines: ReconLine[]
}

export function BankRecon() {
  const [statements, setStatements] = useState<BankStatement[]>([])
  const [statementsLoaded, setStatementsLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState<ReconReport | null>(null)
  const [loading, setLoading] = useState(false)

  const loadStatements = useCallback(async () => {
    const res = await fetch('/api/bank-statements')
    if (res.ok) {
      const d = await res.json()
      setStatements(Array.isArray(d) ? d : [])
    }
    setStatementsLoaded(true)
  }, [])

  const run = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    const res = await fetch(`/api/reconciliation/report?statementId=${selectedId}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [selectedId])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Bank Reconciliation',
        rows: data.lines.map((line) => ({
          Date: String(line.transactionDate).slice(0, 10),
          Description: line.description,
          'Amount (R)': (line.amountCents / 100).toFixed(2),
          'Balance (R)': (line.balanceCents / 100).toFixed(2),
          Status: line.isReconciled ? 'Matched' : 'Unmatched',
        })),
      }],
      `Bank Reconciliation ${data.statement.fileName}`
    )
  }

  return (
    <>
      <ReportHeader title="Bank Reconciliation" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="Statement">
          <select
            className={inputCls + ' min-w-[280px]'}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            onFocus={() => !statementsLoaded && loadStatements()}
          >
            <option value="">Select a statement…</option>
            {statements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.accountType === 'trust' ? 'Trust' : 'Business'} — {s.fileName}
                {s.statementFrom ? ` (${String(s.statementFrom).slice(0, 10)} – ${String(s.statementTo ?? '').slice(0, 10)})` : ''}
              </option>
            ))}
          </select>
        </FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Select a bank statement and run the report" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Lines', value: String(data.summary.totalLines) },
              { label: 'Matched', value: String(data.summary.matchedLines) },
              { label: 'Unmatched', value: String(data.summary.unmatchedLines) },
              { label: 'Adjusted Bank Balance', value: formatCurrency(data.summary.adjustedBankBalance) },
              ...(data.summary.trustControlBalanceCents !== null
                ? [{ label: 'Trust Control Balance', value: formatCurrency(data.summary.trustControlBalanceCents) }]
                : []),
            ].map((kpi, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">{kpi.label}</p>
                <p className="font-sans text-lg font-semibold text-foreground">{kpi.value}</p>
              </div>
            ))}
            {data.summary.isBalanced !== null && (
              <div className={`rounded-lg border p-4 ${data.summary.isBalanced ? 'border-[#22c55e] bg-[#22c55e]/5' : 'border-[#ef4444] bg-[#ef4444]/5'}`}>
                <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Status</p>
                <p className={`font-sans text-sm font-semibold ${data.summary.isBalanced ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {data.summary.isBalanced ? 'Balanced ✓' : 'Out of balance'}
                </p>
              </div>
            )}
          </div>
          <TableWrapper>
            <THead>
              <th className={thCls}>Date</th>
              <th className={thCls}>Description</th>
              <th className={thRCls}>Amount</th>
              <th className={thRCls}>Balance</th>
              <th className={thCls}>Status</th>
            </THead>
            <tbody className="divide-y divide-border">
              {data.lines.map((line) => (
                <tr key={line.id} className="hover:bg-muted/10">
                  <td className={tdCls + ' text-muted-foreground whitespace-nowrap'}>{formatDate(line.transactionDate)}</td>
                  <td className={tdCls}>{line.description}</td>
                  <td className={tdRCls} style={{ color: line.amountCents < 0 ? '#ef4444' : '#22c55e' }}>{formatCurrency(line.amountCents)}</td>
                  <td className={tdRCls}>{formatCurrency(line.balanceCents)}</td>
                  <td className={tdCls}>
                    {line.isReconciled ? (
                      <span className="font-sans text-[11px] text-[#22c55e]">Matched</span>
                    ) : (
                      <span className="font-sans text-[11px] text-[#f59e0b]">Unmatched</span>
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
