'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  inputCls,
} from './report-helpers'

interface JournalLine {
  account: { code: string; name: string }
  debitCents: number
  creditCents: number
  matter?: { matterCode: string } | null
}

interface JournalEntry {
  id: string
  entryDate: string
  narration: string
  referenceNumber: string | null
  lines: JournalLine[]
}

interface JournalData {
  entries: JournalEntry[]
  total: number
}

export function GeneralJournal() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<JournalData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ limit: '200' })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/gl/journal?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to])

  const handleExport = () => {
    if (!data) return
    const rows = data.entries.flatMap((entry) =>
      entry.lines.map((line) => ({
        Date: String(entry.entryDate).slice(0, 10),
        Reference: entry.referenceNumber ?? '',
        Narration: entry.narration,
        'Account Code': line.account.code,
        'Account Name': line.account.name,
        Matter: line.matter?.matterCode ?? '',
        'Debit (R)': (line.debitCents / 100).toFixed(2),
        'Credit (R)': (line.creditCents / 100).toFixed(2),
      }))
    )
    exportToExcel([{ name: 'General Journal', rows }], `General Journal${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`)
  }

  return (
    <>
      <ReportHeader title="General Journal" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : data.entries.length === 0 ? (
        <EmptyState message="No journal entries for this period" />
      ) : (
        <div className="space-y-4">
          <p className="font-sans text-xs text-muted-foreground">{data.total} entries</p>
          {data.entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs text-muted-foreground">{formatDate(entry.entryDate)}</span>
                  {entry.referenceNumber && (
                    <span className="font-sans text-xs text-muted-foreground">{entry.referenceNumber}</span>
                  )}
                </div>
                <span className="font-sans text-xs text-foreground">{entry.narration}</span>
              </div>
              <table className="w-full">
                <tbody>
                  {entry.lines.map((line, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-sans text-xs text-muted-foreground w-20">{line.account.code}</td>
                      <td className="px-4 py-2 font-sans text-xs">{line.account.name}</td>
                      <td className="px-4 py-2 font-sans text-xs text-muted-foreground">{line.matter?.matterCode ?? ''}</td>
                      <td className="px-4 py-2 font-sans text-xs text-right">{line.debitCents ? formatCurrency(line.debitCents) : ''}</td>
                      <td className="px-4 py-2 font-sans text-xs text-right">{line.creditCents ? formatCurrency(line.creditCents) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
