'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Download,
  Send,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { formatMinutes } from '@/lib/time-parser'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('InvoicePreview')

interface LineItem {
  id: string
  entryDate: string
  entryType: string
  costCentre: string
  description: string
  durationMinutesBilled: number | null
  unitQuantityThousandths: number | null
  rateCents: number
  amountCents: number
  discountPct: number
  discountCents: number
  totalCents: number
}

interface InvoiceData {
  id: string
  invoiceNumber: string
  invoiceType: string
  status: string
  invoiceDate: string
  sentAt: string | null
  paidAt: string | null
  paidNote: string | null
  clientName: string
  clientEmail: string | null
  matterCode: string
  matterDescription: string
  firmName: string
  vatRegistered: boolean
  vatRateBps: number
  vatRegNumber: string | null
  trustBankName: string | null
  trustBankAccountName: string | null
  trustBankAccountNumber: string | null
  trustBankBranchCode: string | null
  trustBankSwift: string | null
  invoicePaymentInstructions: string | null
  subTotalCents: number
  vatCents: number
  totalCents: number
  lineItems: LineItem[]
  matter: { id: string }
  createdBy: { firstName: string; lastName: string }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function durationLabel(item: LineItem): string {
  if (item.entryType === 'time' && item.durationMinutesBilled !== null) {
    return formatMinutes(item.durationMinutesBilled)
  }
  if (item.entryType === 'unitary' && item.unitQuantityThousandths !== null) {
    return `×${(item.unitQuantityThousandths / 1000).toFixed(2)}`
  }
  return '—'
}

const STATUS_ACTIONS: Record<string, string[]> = {
  draft_pro_forma: ['send_pro_forma', 'upgrade_to_draft_invoice', 'download_pdf'],
  sent_pro_forma: ['upgrade_to_draft_invoice', 'download_pdf'],
  draft_invoice: ['send_invoice', 'download_pdf'],
  sent_invoice: ['mark_paid', 'download_pdf'],
  paid: ['download_pdf'],
}

const primaryBtnStyle: React.CSSProperties = {
  background: '#B08B82',
  color: '#fff',
  borderRadius: 40,
  padding: '8px 18px',
  border: 'none',
  fontFamily: 'var(--font-noto-sans)',
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(241,237,234,0.70)',
  border: '1px solid rgba(255,255,255,0.20)',
  borderRadius: 40,
  padding: '8px 18px',
  fontFamily: 'var(--font-noto-sans)',
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

export function InvoicePreview({ invoice: initial }: { invoice: InvoiceData }) {
  log.info('mount', { invoiceId: initial.id, invoiceNumber: initial.invoiceNumber, status: initial.status, invoiceType: initial.invoiceType, totalCents: initial.totalCents })
  const router = useRouter()
  const [invoice, setInvoice] = useState(initial)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState(invoice.clientEmail ?? '')
  const [sending, setSending] = useState(false)
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [paidNote, setPaidNote] = useState('')
  const [markingPaid, setMarkingPaid] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const actions = STATUS_ACTIONS[invoice.status] ?? []
  const isProForma = invoice.invoiceType === 'pro_forma'

  const downloadPDF = () => {
    log.info('downloading PDF', { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')
  }

  const transition = async (newStatus: string) => {
    log.info('transitioning invoice', { invoiceId: invoice.id, from: invoice.status, to: newStatus })
    setTransitioning(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transition', status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      log.info('invoice transitioned', { newStatus: updated.status })
      setInvoice(updated)
      toast.success('Invoice updated')
    } catch (err) {
      log.error('invoice transition failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    } finally {
      setTransitioning(false)
    }
  }

  const sendInvoice = async () => {
    log.info('sending invoice', { invoiceId: invoice.id, toEmail: sendEmail })
    setSending(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: sendEmail }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      log.info('invoice sent successfully', { invoiceId: invoice.id })
      setInvoice(updated)
      setSendDialogOpen(false)
      toast.success(`Invoice sent to ${sendEmail}`)
    } catch (err) {
      log.error('invoice send failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const markPaid = async () => {
    log.info('marking invoice as paid', { invoiceId: invoice.id, paidNote })
    setMarkingPaid(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', paidNote }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      log.info('invoice marked as paid', { invoiceId: invoice.id })
      setInvoice(updated)
      setMarkPaidDialogOpen(false)
      toast.success('Invoice marked as paid')
    } catch (err) {
      log.error('mark paid failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to mark paid')
    } finally {
      setMarkingPaid(false)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Dark frosted action bar */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/invoices"
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 12,
              color: 'rgba(241,237,234,0.60)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Invoices
          </Link>
          <div>
            <p style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 11,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'rgba(241,237,234,0.50)',
              marginBottom: 2,
              margin: '0 0 2px 0',
            }}>
              Billing
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 400,
              color: '#F1EDEA',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {invoice.invoiceNumber}
            </h1>
          </div>
          <InvoiceStatusBadge status={invoice.status} invoiceType={invoice.invoiceType} />
          {invoice.sentAt && (
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.50)' }}>
              Sent {fmtDate(invoice.sentAt)}
            </span>
          )}
          {invoice.paidAt && (
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.50)' }}>
              Paid {fmtDate(invoice.paidAt)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {actions.includes('download_pdf') && (
            <button style={secondaryBtnStyle} onClick={downloadPDF}>
              <Download style={{ width: 12, height: 12 }} />
              Download PDF
            </button>
          )}
          {actions.includes('send_pro_forma') && (
            <button style={secondaryBtnStyle} onClick={() => setSendDialogOpen(true)}>
              <Send style={{ width: 12, height: 12 }} />
              Send Pro Forma
            </button>
          )}
          {actions.includes('send_invoice') && (
            <button style={primaryBtnStyle} onClick={() => setSendDialogOpen(true)}>
              <Send style={{ width: 12, height: 12 }} />
              Send Invoice
            </button>
          )}
          {actions.includes('upgrade_to_draft_invoice') && (
            <button
              style={{ ...secondaryBtnStyle, opacity: transitioning ? 0.6 : 1 }}
              disabled={transitioning}
              onClick={() => transition('draft_invoice')}
            >
              <RefreshCw style={{ width: 12, height: 12 }} />
              Convert to Invoice
            </button>
          )}
          {actions.includes('mark_paid') && (
            <button style={primaryBtnStyle} onClick={() => setMarkPaidDialogOpen(true)}>
              <CheckCircle2 style={{ width: 12, height: 12 }} />
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {(invoice.status === 'draft_pro_forma' || invoice.status === 'draft_invoice') ? (
        <div
          className="fade-up"
          style={{
            animationDelay: '40ms',
            background: 'hsl(33 40% 92%)',
            border: '1px solid hsl(33 40% 78%)',
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 14,
            color: 'hsl(33 40% 35%)',
            marginBottom: 16,
          }}
        >
          This {isProForma ? 'pro forma invoice' : 'invoice'} has not yet been sent.
        </div>
      ) : null}

      {/* Invoice document — glass card */}
      <div
        className="fade-up"
        style={{
          animationDelay: '80ms',
          background: 'rgba(255,252,250,0.62)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.80)',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
          overflow: 'hidden',
        }}
      >
        <div className="p-10 space-y-8">

          {/* Firm header */}
          <div className="flex justify-end">
            <div className="text-right">
              <p className="font-serif text-2xl text-foreground mb-1">{invoice.firmName}</p>
            </div>
          </div>

          {/* Doc type + meta */}
          <div className="border-t border-b border-primary/40 py-2">
            <p className="font-serif text-base tracking-[0.15em] uppercase text-primary">
              {isProForma ? 'Pro Forma Invoice' : invoice.vatRegistered ? 'Tax Invoice' : 'Invoice'}
            </p>
          </div>

          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div>
                <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
                  Invoice No
                </p>
                <p className="font-sans text-sm text-foreground">{invoice.invoiceNumber}</p>
              </div>
              {invoice.vatRegistered && invoice.vatRegNumber && (
                <div>
                  <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mt-2">
                    VAT Reg No
                  </p>
                  <p className="font-sans text-sm text-foreground">{invoice.vatRegNumber}</p>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">Date</p>
              <p className="font-sans text-sm text-foreground">{fmtDate(invoice.invoiceDate)}</p>
            </div>
          </div>

          {/* Bill to */}
          <div className="flex justify-between items-baseline">
            <div>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
                Invoice To
              </p>
              <p className="font-sans text-base font-medium text-foreground">{invoice.clientName}</p>
            </div>
            <p className="font-sans text-sm text-muted-foreground">Your Acc: {invoice.matterCode}</p>
          </div>

          {/* Matter heading */}
          <p className="font-serif text-lg text-primary">{invoice.matterDescription}</p>

          {/* Line items table */}
          <div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-border pb-2 mb-1">
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">Description</p>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right pr-6 w-20">Qty</p>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right pr-6 w-24">Unit Rate</p>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground text-right w-24">Total</p>
            </div>

            {invoice.lineItems.map((item, i) => (
              <div
                key={item.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 py-2.5 border-b border-border/50 ${i % 2 === 1 ? 'table-row-stripe' : ''}`}
              >
                <div>
                  <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                    {item.costCentre}
                  </p>
                  <p className="font-sans text-sm text-foreground">{item.description}</p>
                  {fmtDate(item.entryDate) && (
                    <p className="font-sans text-[10px] text-muted-foreground mt-0.5">{fmtDate(item.entryDate)}</p>
                  )}
                </div>
                <p className="font-sans text-xs text-muted-foreground text-right self-center pr-6 w-20">
                  {durationLabel(item)}
                </p>
                <p className="font-sans text-xs text-muted-foreground text-right self-center pr-6 w-24">
                  {item.rateCents > 0 ? formatCurrency(item.rateCents) : '—'}
                </p>
                <div className="text-right w-24 self-center">
                  <p className="font-sans text-sm text-foreground">{formatCurrency(item.totalCents)}</p>
                  {item.discountPct > 0 && (
                    <p className="font-sans text-[10px] text-muted-foreground">{item.discountPct}% disc</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              {invoice.vatRegistered ? (
                <>
                  <div className="flex justify-between font-sans text-sm text-muted-foreground">
                    <span>Subtotal (excl. VAT)</span>
                    <span className="font-sans">{formatCurrency(invoice.subTotalCents)}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm text-muted-foreground">
                    <span>VAT ({((invoice.vatRateBps / 10000) * 100).toFixed(0)}%)</span>
                    <span className="font-sans">{formatCurrency(invoice.vatCents)}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between font-sans text-base font-medium text-foreground">
                    <span>Total (incl. VAT)</span>
                    <span className="font-sans">{formatCurrency(invoice.totalCents)}</span>
                  </div>
                </>
              ) : (
                <div className="border-t border-border pt-1.5 flex justify-between font-sans text-base font-medium text-foreground">
                  <span>Total</span>
                  <span className="font-sans">{formatCurrency(invoice.totalCents)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Banking details */}
          {(invoice.trustBankName || invoice.invoicePaymentInstructions) && (
            <div className="border-t border-border pt-6 space-y-1">
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                Payment Details
              </p>
              {invoice.invoicePaymentInstructions && (
                <p className="font-sans text-sm text-foreground">{invoice.invoicePaymentInstructions}</p>
              )}
              {invoice.trustBankName && (
                <p className="font-sans text-sm text-foreground">
                  {[invoice.trustBankName, invoice.trustBankAccountName, invoice.trustBankAccountNumber ? `Acc: ${invoice.trustBankAccountNumber}` : null, invoice.trustBankBranchCode ? `Branch: ${invoice.trustBankBranchCode}` : null]
                    .filter(Boolean)
                    .join('  |  ')}
                </p>
              )}
              <p className="font-sans text-sm font-medium text-primary">
                Payment reference: {invoice.matterCode}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Send email dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-xl font-light">Send {isProForma ? 'Pro Forma' : 'Invoice'}</h3>
              <p className="font-sans text-sm text-muted-foreground mt-1">
                The PDF will be attached to the email.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Send to
              </Label>
              <Input
                type="text"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="email@client.co.za"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                style={{ ...secondaryBtnStyle, color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                style={{ ...primaryBtnStyle, opacity: sending || !sendEmail ? 0.6 : 1 }}
                onClick={sendInvoice}
                disabled={sending || !sendEmail}
              >
                <Send style={{ width: 12, height: 12 }} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-xl font-light">Mark as Paid</h3>
              <p className="font-sans text-sm text-muted-foreground mt-1">
                {invoice.invoiceNumber} — {formatCurrency(invoice.totalCents)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Payment Note (optional)
              </Label>
              <Input
                type="text"
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                placeholder="e.g. EFT received 19 Mar"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                style={{ ...secondaryBtnStyle, color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                onClick={() => setMarkPaidDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                style={{ ...primaryBtnStyle, opacity: markingPaid ? 0.6 : 1 }}
                onClick={markPaid}
                disabled={markingPaid}
              >
                <CheckCircle2 style={{ width: 12, height: 12 }} />
                {markingPaid ? 'Saving…' : 'Mark Paid'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
