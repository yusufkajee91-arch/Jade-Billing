'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface GlEntry {
  id: string
  date: string
  narration: string
  referenceNumber: string | null
  matterCode: string | null
  debitCents: number
  creditCents: number
  balanceCents: number
}

interface GlAccount {
  id: string
  code: string
  name: string
  accountType: string
}

interface GlDetailData {
  account: GlAccount
  openingBalanceCents: number
  closingBalanceCents: number
  entries: GlEntry[]
  allAccounts: GlAccount[]
}

export function GlDetailReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState<GlDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  // Load account list lazily when first needed
  const [allAccounts, setAllAccounts] = useState<GlAccount[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)

  const loadAccounts = useCallback(async () => {
    if (accountsLoaded) return
    // Use first-run data if available, otherwise fetch via gl-detail with a dummy call
    const res = await fetch('/api/reports/gl-detail?accountId=_list_only_')
    if (res.ok) {
      const d = await res.json()
      if (d.allAccounts) setAllAccounts(d.allAccounts)
    }
    setAccountsLoaded(true)
  }, [accountsLoaded])

  const run = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    const p = new URLSearchParams({ accountId })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/reports/gl-detail?${p}`)
    if (res.ok) {
      const d = await res.json()
      setData(d)
      if (d.allAccounts && !accountsLoaded) {
        setAllAccounts(d.allAccounts)
        setAccountsLoaded(true)
      }
    }
    setLoading(false)
  }, [accountId, from, to, accountsLoaded])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'GL Detail',
        rows: [
          { Date: '', Narration: 'OPENING BALANCE', Reference: '', Matter: '', 'Debit (R)': '', 'Credit (R)': '', 'Balance (R)': (data.openingBalanceCents / 100).toFixed(2) },
          ...data.entries.map((e) => ({
            Date: e.date,
            Narration: e.narration,
            Reference: e.referenceNumber ?? '',
            Matter: e.matterCode ?? '',
            'Debit (R)': e.debitCents ? (e.debitCents / 100).toFixed(2) : '',
            'Credit (R)': e.creditCents ? (e.creditCents / 100).toFixed(2) : '',
            'Balance (R)': (e.balanceCents / 100).toFixed(2),
          })),
          { Date: '', Narration: 'CLOSING BALANCE', Reference: '', Matter: '', 'Debit (R)': '', 'Credit (R)': '', 'Balance (R)': (data.closingBalanceCents / 100).toFixed(2) },
        ],
      }],
      `GL Detail ${data.account.code}${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="GL Account Detail" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="Account">
          <select
            className={inputCls + ' min-w-[240px]'}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            onFocus={() => !accountsLoaded && loadAccounts()}
          >
            <option value="">Select an account…</option>
            {allAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.accountType})</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Select an account and run the report" />
      ) : (
        <>
          <div className="mb-4 p-4 rounded-lg border border-border bg-muted/10">
            <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-1">Account</p>
            <p className="font-sans text-sm font-medium">{data.account.code} — {data.account.name}</p>
            <p className="font-sans text-xs text-muted-foreground capitalize">{data.account.accountType}</p>
          </div>

          <TableWrapper>
            <THead>
              <th className={thCls}>Date</th>
              <th className={thCls}>Narration</th>
              <th className={thCls}>Reference</th>
              <th className={thCls}>Matter</th>
              <th className={thRCls}>Debit</th>
              <th className={thRCls}>Credit</th>
              <th className={thRCls}>Balance</th>
            </THead>
            <tbody className="divide-y divide-border">
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
                data.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/10">
                    <td className={tdCls + ' text-muted-foreground whitespace-nowrap'}>{formatDate(e.date)}</td>
                    <td className={tdCls}>{e.narration}</td>
                    <td className={tdMCls + ' text-muted-foreground'}>{e.referenceNumber ?? '—'}</td>
                    <td className={tdMCls + ' text-muted-foreground'}>{e.matterCode ?? '—'}</td>
                    <td className={tdRCls}>{e.debitCents ? formatCurrency(e.debitCents) : '—'}</td>
                    <td className={tdRCls}>{e.creditCents ? formatCurrency(e.creditCents) : '—'}</td>
                    <td className={tdRCls + ' font-semibold'} style={{ color: e.balanceCents < 0 ? '#ef4444' : ACCENT }}>
                      {formatCurrency(Math.abs(e.balanceCents))}{e.balanceCents < 0 ? ' Cr' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <TFoot>
              <td className={tdCls + ' font-semibold'} colSpan={6}>Closing Balance</td>
              <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>
                {formatCurrency(Math.abs(data.closingBalanceCents))}{data.closingBalanceCents < 0 ? ' Cr' : ''}
              </td>
            </TFoot>
          </TableWrapper>
        </>
      )}
    </>
  )
}
