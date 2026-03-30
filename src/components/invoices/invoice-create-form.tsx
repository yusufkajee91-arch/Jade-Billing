'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { formatMinutes } from '@/lib/time-parser'

interface FeeEntry {
  id: string
  entryType: string
  entryDate: string
  narration: string
  durationMinutesBilled: number | null
  unitQuantityThousandths: number | null
  rateCents: number
  totalCents: number
  feeEarner: { firstName: string; lastName: string }
}

interface Matter {
  id: string
  matterCode: string
  description: string
  client: { clientName: string }
}

interface InvoiceCreateFormProps {
  matter: Matter
  feeEntries: FeeEntry[]
  preselectedIds: string[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function durationLabel(entry: FeeEntry): string {
  if (entry.entryType === 'time' && entry.durationMinutesBilled !== null) {
    return formatMinutes(entry.durationMinutesBilled)
  }
  if (entry.entryType === 'unitary' && entry.unitQuantityThousandths !== null) {
    return `×${(entry.unitQuantityThousandths / 1000).toFixed(2)}`
  }
  return '—'
}

export function InvoiceCreateForm({ matter, feeEntries, preselectedIds }: InvoiceCreateFormProps) {
  const router = useRouter()

  const initial = preselectedIds.length > 0
    ? new Set(preselectedIds.filter((id) => feeEntries.some((e) => e.id === id)))
    : new Set(feeEntries.map((e) => e.id))

  const [selected, setSelected] = useState<Set<string>>(initial)
  const [invoiceType, setInvoiceType] = useState<'pro_forma' | 'invoice'>('invoice')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  const selectedEntries = feeEntries.filter((e) => selected.has(e.id))
  const totalCents = selectedEntries.reduce((s, e) => s + e.totalCents, 0)

  const toggleEntry = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === feeEntries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(feeEntries.map((e) => e.id)))
    }
  }

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one entry to invoice')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: matter.id,
          feeEntryIds: Array.from(selected),
          invoiceType,
          invoiceDate,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create invoice')
      }
      const invoice = await res.json()
      toast.success('Invoice created')
      router.push(`/invoices/${invoice.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/matters/${matter.id}`}
          className="inline-flex items-center gap-1 font-sans text-xs tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {matter.matterCode}
        </Link>
      </div>

      <div>
        <h1 className="font-serif text-[32px] font-light text-foreground leading-tight">
          New Invoice
        </h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          {matter.client.clientName} — {matter.description}
        </p>
      </div>

      {/* Invoice settings */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-serif text-lg text-foreground">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Invoice Type
              </Label>
              <Select
                value={invoiceType}
                onValueChange={(v) => setInvoiceType(v as 'pro_forma' | 'invoice')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Tax Invoice</SelectItem>
                  <SelectItem value="pro_forma">Pro Forma Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Invoice Date
              </Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entry selection */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-foreground">Entries to Invoice</h2>
            {feeEntries.length > 0 && (
              <button
                onClick={toggleAll}
                className="font-sans text-xs text-muted-foreground hover:text-foreground tracking-wide uppercase transition-colors"
              >
                {selected.size === feeEntries.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {feeEntries.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-sans text-sm text-muted-foreground">
                No unbilled entries available for this matter.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              {feeEntries.map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => toggleEntry(entry.id)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors hover:bg-secondary/40 ${
                    i % 2 === 1 ? 'table-row-stripe' : ''
                  } ${selected.has(entry.id) ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                    selected.has(entry.id)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {selected.has(entry.id) && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-foreground truncate">{entry.narration}</p>
                    <p className="font-sans text-xs text-muted-foreground mt-0.5">
                      {fmtDate(entry.entryDate)} · {entry.feeEarner.firstName} {entry.feeEarner.lastName}
                      {entry.entryType !== 'disbursement' && ` · ${durationLabel(entry)}`}
                    </p>
                  </div>
                  <p className="font-sans text-sm text-foreground flex-shrink-0 self-center">
                    {formatCurrency(entry.totalCents)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer with total + submit */}
      <div className="flex items-center justify-between pb-8">
        <div>
          <p className="font-sans text-xs text-muted-foreground tracking-wide uppercase">
            {selected.size} of {feeEntries.length} entries selected
          </p>
          <p className="font-sans text-xl text-foreground mt-0.5">
            {formatCurrency(totalCents)}
          </p>
          <p className="font-sans text-xs text-muted-foreground">excl. VAT</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="font-sans text-xs tracking-wide uppercase"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            className="bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase"
          >
            <FileText className="h-3 w-3 mr-1.5" />
            {submitting ? 'Creating…' : `Create ${invoiceType === 'pro_forma' ? 'Pro Forma' : 'Invoice'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
