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

interface BalanceSheetData {
  assets: AccountLine[]
  liabilities: AccountLine[]
  equity: AccountLine[]
  totalAssetsCents: number
  totalLiabilitiesCents: number
  totalEquityCents: number
  balanceCheck: number
}

export function BalanceSheetReport() {
  const [asAt, setAsAt] = useState('')
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (asAt) p.set('asAt', asAt)
    const res = await fetch(`/api/reports/balance-sheet?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [asAt])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Balance Sheet',
        rows: [
          { Section: 'ASSETS', Code: '', Account: '', 'Amount (R)': '' },
          ...data.assets.map((a) => ({ Section: '', Code: a.code, Account: a.name, 'Amount (R)': (a.balanceCents / 100).toFixed(2) })),
          { Section: 'Total Assets', Code: '', Account: '', 'Amount (R)': (data.totalAssetsCents / 100).toFixed(2) },
          { Section: '', Code: '', Account: '', 'Amount (R)': '' },
          { Section: 'LIABILITIES', Code: '', Account: '', 'Amount (R)': '' },
          ...data.liabilities.map((a) => ({ Section: '', Code: a.code, Account: a.name, 'Amount (R)': (a.balanceCents / 100).toFixed(2) })),
          { Section: 'Total Liabilities', Code: '', Account: '', 'Amount (R)': (data.totalLiabilitiesCents / 100).toFixed(2) },
          { Section: '', Code: '', Account: '', 'Amount (R)': '' },
          { Section: 'EQUITY', Code: '', Account: '', 'Amount (R)': '' },
          ...data.equity.map((a) => ({ Section: '', Code: a.code, Account: a.name, 'Amount (R)': (a.balanceCents / 100).toFixed(2) })),
          { Section: 'Total Equity', Code: '', Account: '', 'Amount (R)': (data.totalEquityCents / 100).toFixed(2) },
        ],
      }],
      `Balance Sheet${asAt ? ` as at ${asAt}` : ''}`
    )
  }

  const BalanceSection = ({ title, rows, total, color }: { title: string; rows: AccountLine[]; total: number; color?: string }) => (
    <div>
      <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">{title}</p>
      <TableWrapper>
        <THead>
          <th className={thCls}>Code</th>
          <th className={thCls}>Account</th>
          <th className={thRCls}>Balance</th>
        </THead>
        <tbody className="divide-y divide-border">
          {rows.map((a) => (
            <tr key={a.code} className="hover:bg-muted/10">
              <td className={tdMCls + ' text-muted-foreground'}>{a.code}</td>
              <td className={tdCls}>{a.name}</td>
              <td className={tdRCls} style={{ color: color || ACCENT }}>{formatCurrency(a.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
        <TFoot>
          <td className={tdCls + ' font-semibold'} colSpan={2}>Total {title}</td>
          <td className={tdRCls + ' font-bold'} style={{ color: color || ACCENT }}>{formatCurrency(total)}</td>
        </TFoot>
      </TableWrapper>
    </div>
  )

  return (
    <>
      <ReportHeader title="Balance Sheet" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="As At">
          <input type="date" className={inputCls} value={asAt} onChange={(e) => setAsAt(e.target.value)} />
        </FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Run the report to see the balance sheet" />
      ) : (
        <div className="space-y-6">
          <BalanceSection title="Assets" rows={data.assets} total={data.totalAssetsCents} color="#22c55e" />
          <BalanceSection title="Liabilities" rows={data.liabilities} total={data.totalLiabilitiesCents} color="#ef4444" />
          <BalanceSection title="Equity" rows={data.equity} total={data.totalEquityCents} />

          {/* Balance check indicator */}
          {data.balanceCheck !== 0 && (
            <div className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/5 p-4">
              <p className="font-sans text-sm text-[#ef4444]">
                Balance sheet is out by {formatCurrency(Math.abs(data.balanceCheck))} — check journal entries.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
