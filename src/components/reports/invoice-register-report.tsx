'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportToExcel } from '@/lib/excel-export'
import {
  ReportHeader, FilterRow, FilterField, RunButton, EmptyState,
  TableWrapper, THead, TFoot, ACCENT, inputCls, thCls, thRCls, tdCls, tdMCls, tdRCls,
} from './report-helpers'

interface InvoiceRow {
  id: string
  invoiceNumber: string
  invoiceType: string
  status: string
  clientName: string
  matterCode: string
  matterDescription: string
  invoiceDate: string
  subTotalCents: number
  vatCents: number
  totalCents: number
  sentAt: string | null
  paidAt: string | null
}

interface InvoiceRegisterData {
  invoices: InvoiceRow[]
  totals: { subTotalCents: number; vatCents: number; totalCents: number }
}

const STATUS_LABELS: Record<string, string> = {
  draft_pro_forma: 'Draft PF',
  sent_pro_forma: 'Sent PF',
  draft_invoice: 'Draft',
  sent_invoice: 'Sent',
  paid: 'Paid',
}
const STATUS_COLORS: Record<string, string> = {
  draft_pro_forma: '#94a3b8',
  sent_pro_forma: '#60a5fa',
  draft_invoice: '#f59e0b',
  sent_invoice: '#f97316',
  paid: '#22c55e',
}

export function InvoiceRegister() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('all')
  const [data, setData] = useState<InvoiceRegisterData | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ status })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const res = await fetch(`/api/reports/invoice-register?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to, status])

  const handleExport = () => {
    if (!data) return
    exportToExcel(
      [{
        name: 'Invoice Register',
        rows: data.invoices.map((inv) => ({
          Number: inv.invoiceNumber,
          Client: inv.clientName,
          Matter: inv.matterCode,
          Date: String(inv.invoiceDate).slice(0, 10),
          Status: STATUS_LABELS[inv.status] ?? inv.status,
          'Excl VAT (R)': (inv.subTotalCents / 100).toFixed(2),
          'VAT (R)': (inv.vatCents / 100).toFixed(2),
          'Total (R)': (inv.totalCents / 100).toFixed(2),
        })),
      }],
      `Invoice Register${from ? ` ${from}` : ''}${to ? ` to ${to}` : ''}`
    )
  }

  return (
    <>
      <ReportHeader title="Invoice Register" onPrint={() => window.print()} onExport={data ? handleExport : undefined} />
      <FilterRow>
        <FilterField label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
        <FilterField label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        <FilterField label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="draft_invoice">Draft</option>
            <option value="sent_invoice">Sent</option>
            <option value="paid">Paid</option>
            <option value="draft_pro_forma">Draft Pro Forma</option>
            <option value="sent_pro_forma">Sent Pro Forma</option>
          </select>
        </FilterField>
        <RunButton onClick={run} loading={loading} />
      </FilterRow>
      {!data ? (
        <EmptyState message="Set filters and run the report" />
      ) : data.invoices.length === 0 ? (
        <EmptyState message="No invoices match the selected filters" />
      ) : (
        <TableWrapper>
          <THead>
            <th className={thCls}>Number</th>
            <th className={thCls}>Client</th>
            <th className={thCls}>Matter</th>
            <th className={thCls}>Date</th>
            <th className={thCls}>Status</th>
            <th className={thRCls}>Excl. VAT</th>
            <th className={thRCls}>VAT</th>
            <th className={thRCls}>Total</th>
          </THead>
          <tbody className="divide-y divide-border">
            {data.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/10">
                <td className={tdMCls + ' text-muted-foreground'}>{inv.invoiceNumber}</td>
                <td className={tdCls}>{inv.clientName}</td>
                <td className={tdMCls + ' text-muted-foreground'}>{inv.matterCode}</td>
                <td className={tdCls + ' text-muted-foreground'}>{formatDate(inv.invoiceDate)}</td>
                <td className={tdCls}>
                  <span className="font-sans text-[11px] font-medium" style={{ color: STATUS_COLORS[inv.status] }}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </td>
                <td className={tdRCls}>{formatCurrency(inv.subTotalCents)}</td>
                <td className={tdRCls + ' text-muted-foreground'}>{inv.vatCents ? formatCurrency(inv.vatCents) : '—'}</td>
                <td className={tdRCls + ' font-semibold'} style={{ color: ACCENT }}>{formatCurrency(inv.totalCents)}</td>
              </tr>
            ))}
          </tbody>
          <TFoot>
            <td className={tdCls + ' font-semibold'} colSpan={5}>Totals</td>
            <td className={tdRCls + ' font-bold'}>{formatCurrency(data.totals.subTotalCents)}</td>
            <td className={tdRCls + ' font-bold'}>{formatCurrency(data.totals.vatCents)}</td>
            <td className={tdRCls + ' font-bold'} style={{ color: ACCENT }}>{formatCurrency(data.totals.totalCents)}</td>
          </TFoot>
        </TableWrapper>
      )}
    </>
  )
}
