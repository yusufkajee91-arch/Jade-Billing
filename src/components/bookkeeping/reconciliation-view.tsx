'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  Trash2,
  Zap,
  FileText,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Session } from 'next-auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankStatementSummary {
  id: string
  accountType: 'trust' | 'business'
  fileName: string
  accountNumber: string | null
  accountDescription: string | null
  statementFrom: string | null
  statementTo: string | null
  openingBalanceCents: number
  closingBalanceCents: number
  importedAt: string
  _count: { lines: number }
  matchedCount: number
  importedBy: { id: string; firstName: string; lastName: string; initials: string }
}

interface BankMatch {
  id: string
  trustEntry?: {
    id: string
    entryType: string
    entryDate: string
    amountCents: number
    narration: string
  } | null
  businessEntry?: {
    id: string
    entryType: string
    entryDate: string
    amountCents: number
    narration: string
  } | null
  matchedBy: { id: string; firstName: string; lastName: string }
}

interface BankStatementLine {
  id: string
  lineNumber: number
  transactionDate: string
  amountCents: number
  balanceCents: number
  description: string
  reference: string | null
  isReconciled: boolean
  matches: BankMatch[]
}

interface StatementDetail {
  id: string
  accountType: 'trust' | 'business'
  fileName: string
  accountNumber: string | null
  accountDescription: string | null
  statementFrom: string | null
  statementTo: string | null
  openingBalanceCents: number
  closingBalanceCents: number
  importedAt: string
  lines: BankStatementLine[]
}

interface LedgerEntry {
  id: string
  entryType: string
  entryDate: string
  amountCents: number
  narration: string
  referenceNumber: string | null
  matter?: { id: string; matterCode: string; description: string } | null
}

interface ReconReport {
  statement: {
    id: string
    accountType: string
    closingBalanceCents: number
    statementFrom: string | null
    statementTo: string | null
  }
  summary: {
    totalLines: number
    matchedLines: number
    unmatchedLines: number
    depositsInTransit: number
    outstandingPayments: number
    adjustedBankBalance: number
    trustControlBalanceCents: number | null
    isBalanced: boolean | null
  }
  lines: BankStatementLine[]
  unmatchedLedgerEntries: LedgerEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRUST_COLOR = '#8897C0'
const BUSINESS_COLOR = '#B08B82'

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  trust_receipt: 'Trust Receipt',
  trust_payment: 'Trust Payment',
  trust_transfer_in: 'Transfer In',
  trust_transfer_out: 'Transfer Out',
  collection_receipt: 'Collection Receipt',
  matter_receipt: 'Matter Receipt',
  matter_payment: 'Matter Payment',
  business_receipt: 'Business Receipt',
  business_payment: 'Business Payment',
  supplier_invoice: 'Supplier Invoice',
  supplier_payment: 'Supplier Payment',
  bank_transfer: 'Bank Transfer',
  trust_to_business: 'Trust → Business',
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  session: Session
}

export function ReconciliationView({ session }: Props) {
  const isAdmin = session.user.role === 'admin'

  const [activeTab, setActiveTab] = useState<'statements' | 'reconcile'>('statements')
  const [statements, setStatements] = useState<BankStatementSummary[]>([])
  const [loadingStatements, setLoadingStatements] = useState(true)

  const [selectedStatement, setSelectedStatement] = useState<StatementDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [report, setReport] = useState<ReconReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const [showUploadForm, setShowUploadForm] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Left panel: selected bank line
  const [selectedBankLine, setSelectedBankLine] = useState<BankStatementLine | null>(null)

  // ─── Data loaders ────────────────────────────────────────────────────────

  const loadStatements = useCallback(async () => {
    setLoadingStatements(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/bank-statements')
      if (res.ok) setStatements(await res.json())
      else setLoadError('Failed to load statements — please refresh the page')
    } finally {
      setLoadingStatements(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/bank-statements/${id}`)
      if (res.ok) setSelectedStatement(await res.json())
      else toast.error('Failed to load statement detail')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const loadReport = useCallback(async (id: string) => {
    setLoadingReport(true)
    try {
      const res = await fetch(`/api/reconciliation/report?statementId=${id}`)
      if (res.ok) setReport(await res.json())
      else toast.error('Failed to load reconciliation report')
    } finally {
      setLoadingReport(false)
    }
  }, [])

  // Dismiss any stale toasts left over from previous pages before loading
  useEffect(() => {
    toast.dismiss()
    loadStatements()
  }, [loadStatements])

  const handleSelectStatement = useCallback(
    async (stmt: BankStatementSummary) => {
      setSelectedBankLine(null)
      setReport(null)
      setActiveTab('reconcile')
      await loadDetail(stmt.id)
      await loadReport(stmt.id)
    },
    [loadDetail, loadReport],
  )

  const refreshReconcile = useCallback(async () => {
    if (!selectedStatement) return
    await loadDetail(selectedStatement.id)
    await loadReport(selectedStatement.id)
    await loadStatements()
  }, [selectedStatement, loadDetail, loadReport, loadStatements])

  // ─── Upload handler ───────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (accountType: string, file: File): Promise<string | null> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountType', accountType)

      const res = await fetch('/api/bank-statements', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        toast.success('Statement imported successfully')
        setShowUploadForm(false)
        await loadStatements()
        return null
      } else {
        const text = await res.text().catch(() => '')
        let message = `Upload failed (HTTP ${res.status})`
        try {
          const data = JSON.parse(text)
          if (data.error) message = data.error
        } catch {
          // Response was HTML (server crash) — show status and first line of body
          const firstLine = text.split('\n').find(l => l.trim()) ?? ''
          if (firstLine) message = `Server error ${res.status}: ${firstLine.slice(0, 120)}`
        }
        return message
      }
    },
    [loadStatements],
  )

  // ─── Delete statement ─────────────────────────────────────────────────────

  const handleDeleteStatement = useCallback(
    async (id: string) => {
      if (!confirm('Delete this bank statement and all its matches?')) return
      const res = await fetch(`/api/bank-statements/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        toast.success('Statement deleted')
        if (selectedStatement?.id === id) {
          setSelectedStatement(null)
          setReport(null)
          setActiveTab('statements')
        }
        await loadStatements()
      } else {
        toast.error('Delete failed')
      }
    },
    [selectedStatement, loadStatements],
  )

  // ─── Auto-match ───────────────────────────────────────────────────────────

  const handleAutoMatch = useCallback(async () => {
    if (!selectedStatement) return
    const res = await fetch(`/api/bank-statements/${selectedStatement.id}/auto-match`, {
      method: 'POST',
    })
    if (res.ok) {
      const { matchesCreated } = await res.json()
      toast.success(`Auto-matched ${matchesCreated} line${matchesCreated !== 1 ? 's' : ''}`)
      await refreshReconcile()
    } else {
      toast.error('Auto-match failed')
    }
  }, [selectedStatement, refreshReconcile])

  // ─── Manual match ─────────────────────────────────────────────────────────

  const handleManualMatch = useCallback(
    async (ledgerEntry: LedgerEntry, isTrust: boolean) => {
      if (!selectedBankLine) return
      const body: Record<string, string> = {
        bankStatementLineId: selectedBankLine.id,
      }
      if (isTrust) body.trustEntryId = ledgerEntry.id
      else body.businessEntryId = ledgerEntry.id

      const res = await fetch('/api/bank-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Match created')
        setSelectedBankLine(null)
        await refreshReconcile()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Match failed')
      }
    },
    [selectedBankLine, refreshReconcile],
  )

  // ─── Unmatch ──────────────────────────────────────────────────────────────

  const handleUnmatch = useCallback(
    async (matchId: string) => {
      const res = await fetch(`/api/bank-matches/${matchId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        toast.success('Match removed')
        await refreshReconcile()
      } else {
        toast.error('Unmatch failed')
      }
    },
    [refreshReconcile],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  const accentColor =
    selectedStatement?.accountType === 'business' ? BUSINESS_COLOR : TRUST_COLOR

  const tabs = [
    { id: 'statements' as const, label: 'Statements' },
    ...(selectedStatement
      ? [{ id: 'reconcile' as const, label: 'Reconcile' }]
      : []),
  ]

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* ── Dark header ───────────────────────────────────────────────── */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Accounts
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Reconciliation
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && activeTab === 'statements' && (
            <button
              onClick={() => setShowUploadForm(v => !v)}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: TRUST_COLOR, borderRadius: 40, padding: '10px 22px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Upload style={{ width: 14, height: 14 }} />
              Import Statement
            </button>
          )}
          {selectedStatement && activeTab === 'reconcile' && (
            <button
              onClick={handleAutoMatch}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: accentColor, background: 'rgba(255,255,255,0.12)', borderRadius: 40, padding: '10px 22px', border: `1px solid ${accentColor}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Zap style={{ width: 14, height: 14 }} />
              Auto-Match
            </button>
          )}
        </div>
      </div>

      {/* ── Upload Form ───────────────────────────────────────────────── */}
      {showUploadForm && (
        <div className="fade-up" style={{ animationDelay: '60ms', marginBottom: 16 }}>
          <UploadForm onUpload={handleUpload} onCancel={() => setShowUploadForm(false)} />
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(216,211,203,0.5)', padding: '0 20px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '14px 16px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? accentColor : 'transparent'}`,
                background: 'none',
                cursor: 'pointer',
                color: activeTab === t.id ? '#3E3B36' : '#80796F',
                transition: 'color 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {/* ── Statements Tab ──────────────────────────────────────────── */}
          {activeTab === 'statements' && (
            <StatementsTab
              statements={statements}
              loading={loadingStatements}
              loadError={loadError}
              isAdmin={isAdmin}
              onReconcile={handleSelectStatement}
              onDelete={handleDeleteStatement}
            />
          )}

          {/* ── Reconcile Tab ───────────────────────────────────────────── */}
          {activeTab === 'reconcile' && selectedStatement && (
            <ReconcileTab
              statement={selectedStatement}
              report={report}
              loadingDetail={loadingDetail}
              loadingReport={loadingReport}
              selectedBankLine={selectedBankLine}
              onSelectBankLine={setSelectedBankLine}
              onManualMatch={handleManualMatch}
              onUnmatch={handleUnmatch}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Upload Form ──────────────────────────────────────────────────────────────

function UploadForm({
  onUpload,
  onCancel,
}: {
  onUpload: (accountType: string, file: File) => Promise<string | null>
  onCancel: () => void
}) {
  const [accountType, setAccountType] = useState<'trust' | 'business'>('trust')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploadError(null)
    setLoading(true)
    try {
      const error = await onUpload(accountType, file)
      if (error) setUploadError(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: 'rgba(255,252,250,0.62)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.80)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
        Import Bank Statement
      </p>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
            Account Type
          </label>
          <select
            value={accountType}
            onChange={e => setAccountType(e.target.value as 'trust' | 'business')}
            className="block h-8 rounded border border-border bg-background px-2 font-sans text-xs"
          >
            <option value="trust">Trust</option>
            <option value="business">Business</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
            CSV File
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-2 font-sans text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Choose File
              <input
                type="file"
                accept=".csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
                required
              />
            </label>
            <span className="font-sans text-xs text-muted-foreground">
              {file?.name ?? 'No file selected'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!file || loading}>
            {loading ? 'Importing…' : 'Import'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2.5 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="font-sans text-xs text-destructive">{uploadError}</p>
        </div>
      )}
    </form>
  )
}

// ─── Statements Tab ───────────────────────────────────────────────────────────

function StatementsTab({
  statements,
  loading,
  loadError,
  isAdmin,
  onReconcile,
  onDelete,
}: {
  statements: BankStatementSummary[]
  loading: boolean
  loadError: string | null
  isAdmin: boolean
  onReconcile: (s: BankStatementSummary) => void
  onDelete: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground font-sans text-xs tracking-wide uppercase">
        Loading…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="py-20 text-center text-muted-foreground font-sans text-xs tracking-wide">
        {loadError}
      </div>
    )
  }

  if (statements.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground font-sans text-xs tracking-wide">
        No statements uploaded yet — upload your first FNB CSV above
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {statements.map(stmt => {
        const color = stmt.accountType === 'trust' ? TRUST_COLOR : BUSINESS_COLOR
        const totalLines = stmt._count.lines
        const matchedCount = stmt.matchedCount
        const pct = totalLines > 0 ? Math.round((matchedCount / totalLines) * 100) : 0

        return (
          <div
            key={stmt.id}
            style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.6)', borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            {/* Account type badge */}
            <div
              className="flex-shrink-0 rounded px-2 py-0.5 font-sans text-[10px] tracking-widest uppercase text-white"
              style={{ backgroundColor: color }}
            >
              {stmt.accountType}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="font-sans text-xs truncate">{stmt.fileName}</p>
                {stmt.accountDescription && (
                  <p className="font-sans text-xs text-muted-foreground truncate">
                    {stmt.accountDescription}
                  </p>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground">
                {stmt.statementFrom && stmt.statementTo && (
                  <span className="font-sans text-[11px]">
                    {formatDate(stmt.statementFrom)} – {formatDate(stmt.statementTo)}
                  </span>
                )}
                <span className="font-sans text-[10px] tracking-wide uppercase">
                  {matchedCount}/{totalLines} matched ({pct}%)
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  Imported {formatDate(stmt.importedAt)} by {stmt.importedBy.initials}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden w-48">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? '#22c55e' : color,
                  }}
                />
              </div>
            </div>

            {/* Closing balance */}
            <div className="text-right flex-shrink-0">
              <p className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
                Closing Balance
              </p>
              <p className="font-sans text-sm font-semibold" style={{ color }}>
                {formatCurrency(stmt.closingBalanceCents)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReconcile(stmt)}
                className="font-sans text-xs tracking-wide uppercase"
                style={{ borderColor: color, color }}
              >
                Reconcile
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(stmt.id)}
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Reconcile Tab ────────────────────────────────────────────────────────────

function ReconcileTab({
  statement,
  report,
  loadingDetail,
  loadingReport,
  selectedBankLine,
  onSelectBankLine,
  onManualMatch,
  onUnmatch,
  isAdmin,
}: {
  statement: StatementDetail
  report: ReconReport | null
  loadingDetail: boolean
  loadingReport: boolean
  selectedBankLine: BankStatementLine | null
  onSelectBankLine: (line: BankStatementLine | null) => void
  onManualMatch: (entry: LedgerEntry, isTrust: boolean) => void
  onUnmatch: (matchId: string) => void
  isAdmin: boolean
}) {
  const color = statement.accountType === 'trust' ? TRUST_COLOR : BUSINESS_COLOR
  const isTrust = statement.accountType === 'trust'

  return (
    <div className="space-y-6">
      {/* Statement header */}
      <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 12, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
            File
          </p>
          <p className="font-sans text-xs">{statement.fileName}</p>
        </div>
        {statement.statementFrom && statement.statementTo && (
          <div>
            <p className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
              Period
            </p>
            <p className="font-sans text-xs">
              {formatDate(statement.statementFrom)} – {formatDate(statement.statementTo)}
            </p>
          </div>
        )}
        <div>
          <p className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
            Closing Balance
          </p>
          <p className="font-sans text-sm font-semibold" style={{ color }}>
            {formatCurrency(statement.closingBalanceCents)}
          </p>
        </div>
      </div>

      {/* Side-by-side panels */}
      {loadingDetail ? (
        <div className="py-12 text-center text-muted-foreground font-sans text-xs tracking-wide uppercase">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Bank Statement Lines */}
          <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.6)', borderRadius: 12, overflow: 'hidden' }}>
            <div
              style={{ padding: '10px 16px', borderBottom: '1px solid rgba(216,211,203,0.5)', backgroundColor: `${color}15` }}
            >
              <p
                className="font-sans text-[10px] tracking-widest uppercase font-semibold"
                style={{ color }}
              >
                Bank Statement Lines
              </p>
            </div>
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {statement.lines.length === 0 && (
                <div className="py-8 text-center text-muted-foreground font-sans text-xs">
                  No lines
                </div>
              )}
              {statement.lines.map(line => {
                const matched = line.isReconciled
                const isSelected = selectedBankLine?.id === line.id
                const match = line.matches[0]
                const linkedEntry = match?.trustEntry ?? match?.businessEntry

                return (
                  <div
                    key={line.id}
                    className={`px-4 py-2.5 cursor-pointer transition-colors ${
                      matched
                        ? 'bg-green-50'
                        : isSelected
                        ? 'bg-amber-100'
                        : 'bg-amber-50/50 hover:bg-amber-50'
                    }`}
                    onClick={() => {
                      if (!matched) {
                        onSelectBankLine(isSelected ? null : line)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {matched ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          <p className="font-sans text-xs truncate">{line.description}</p>
                        </div>
                        {line.reference && (
                          <p className="font-sans text-[10px] text-muted-foreground ml-5">
                            Ref: {line.reference}
                          </p>
                        )}
                        {matched && linkedEntry && (
                          <p className="font-sans text-[10px] text-green-700 ml-5 truncate">
                            ↔ {linkedEntry.narration}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-sans text-xs">
                          <span className="font-sans text-[10px] text-muted-foreground">
                            {formatDate(line.transactionDate)}
                          </span>
                        </p>
                        <p
                          className={`font-sans text-sm font-semibold ${
                            line.amountCents >= 0 ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {line.amountCents >= 0 ? '+' : ''}
                          {formatCurrency(line.amountCents)}
                        </p>
                      </div>
                    </div>

                    {/* Unmatch button */}
                    {matched && isAdmin && match && (
                      <div className="mt-1 flex justify-end">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onUnmatch(match.id)
                          }}
                          className="font-sans text-[10px] tracking-wide uppercase text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Unlink className="h-3 w-3" />
                          Unmatch
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Ledger Entries */}
          <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.6)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(216,211,203,0.5)', background: 'rgba(216,211,203,0.2)' }}>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
                Unmatched Ledger Entries
                {selectedBankLine && (
                  <span className="ml-2 text-amber-600">
                    — click to match with selected bank line
                  </span>
                )}
              </p>
            </div>
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {!report && (
                <div className="py-8 text-center text-muted-foreground font-sans text-xs">
                  {loadingReport ? 'Loading…' : 'No data'}
                </div>
              )}
              {report?.unmatchedLedgerEntries.length === 0 && (
                <div className="py-8 text-center text-muted-foreground font-sans text-xs">
                  All ledger entries matched
                </div>
              )}
              {report?.unmatchedLedgerEntries.map(entry => (
                <div
                  key={entry.id}
                  className={`px-4 py-2.5 transition-colors ${
                    selectedBankLine
                      ? 'cursor-pointer hover:bg-[rgba(136,151,192,0.08)]'
                      : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (selectedBankLine) onManualMatch(entry, isTrust)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <p className="font-sans text-xs truncate">{entry.narration}</p>
                      </div>
                      <div className="ml-5 flex items-center gap-2">
                        <span className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground">
                          {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                        </span>
                        {entry.matter && (
                          <span className="font-sans text-[10px] text-muted-foreground">
                            {entry.matter.matterCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-sans text-[10px] text-muted-foreground">
                        {formatDate(entry.entryDate)}
                      </p>
                      <p className="font-sans text-sm font-semibold" style={{ color }}>
                        {formatCurrency(entry.amountCents)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliation Report ───────────────────────────────────── */}
      {report && (
        <ReconReportPanel report={report} isTrust={isTrust} color={color} />
      )}
    </div>
  )
}

// ─── Reconciliation Report Panel ──────────────────────────────────────────────

function ReconReportPanel({
  report,
  isTrust,
  color,
}: {
  report: ReconReport
  isTrust: boolean
  color: string
}) {
  const s = report.summary
  const balanced = s.isBalanced

  return (
    <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.6)', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
      <div
        style={{ padding: '10px 16px', borderBottom: '1px solid rgba(216,211,203,0.5)', backgroundColor: `${color}15` }}
      >
        <p
          className="font-sans text-[10px] tracking-widest uppercase font-semibold"
          style={{ color }}
        >
          Reconciliation Report
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCell
            label="Total Lines"
            value={String(s.totalLines)}
            mono
          />
          <StatCell
            label="Matched"
            value={String(s.matchedLines)}
            mono
            valueColor="#22c55e"
          />
          <StatCell
            label="Unmatched"
            value={String(s.unmatchedLines)}
            mono
            valueColor={s.unmatchedLines > 0 ? '#f59e0b' : undefined}
          />
        </div>

        <div className="border-t border-border pt-4">
          {isTrust ? (
            <TrustReconLayout s={s} />
          ) : (
            <BusinessReconLayout s={s} />
          )}
        </div>

        {/* Balanced indicator */}
        {isTrust && balanced !== null && (
          <div
            className={`rounded-md px-4 py-3 flex items-center gap-3 ${
              balanced ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {balanced ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-500" />
            )}
            <p className="font-sans text-xs tracking-wide uppercase font-semibold">
              {balanced
                ? 'Trust bank account is balanced with ledger'
                : 'Trust bank account does NOT balance with ledger'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TrustReconLayout({ s }: { s: ReconReport['summary'] }) {
  return (
    <div className="space-y-1.5 max-w-sm">
      <ReconLine label="Closing Bank Balance" value={s.adjustedBankBalance - s.depositsInTransit - s.outstandingPayments} />
      <ReconLine label="Add: Deposits in Transit" value={s.depositsInTransit} sign="+" />
      <ReconLine label="Less: Outstanding Payments" value={-s.outstandingPayments} sign="-" negate />
      <div className="border-t border-border pt-1.5">
        <ReconLine label="Adjusted Bank Balance" value={s.adjustedBankBalance} bold />
      </div>
      {s.trustControlBalanceCents !== null && (
        <>
          <ReconLine label="Trust Ledger Control Balance" value={s.trustControlBalanceCents} bold />
          <ReconLine
            label="Difference"
            value={s.adjustedBankBalance - s.trustControlBalanceCents}
            bold
            valueColor={
              s.adjustedBankBalance === s.trustControlBalanceCents ? '#22c55e' : '#ef4444'
            }
          />
        </>
      )}
    </div>
  )
}

function BusinessReconLayout({ s }: { s: ReconReport['summary'] }) {
  return (
    <div className="space-y-1.5 max-w-sm">
      <ReconLine label="Closing Bank Balance" value={s.adjustedBankBalance - s.depositsInTransit - s.outstandingPayments} />
      <ReconLine label="Add: Deposits in Transit" value={s.depositsInTransit} sign="+" />
      <ReconLine label="Less: Outstanding Payments" value={-s.outstandingPayments} sign="-" negate />
      <div className="border-t border-border pt-1.5">
        <ReconLine label="Adjusted Bank Balance" value={s.adjustedBankBalance} bold />
      </div>
    </div>
  )
}

function ReconLine({
  label,
  value,
  sign,
  bold,
  valueColor,
  negate,
}: {
  label: string
  value: number
  sign?: string
  bold?: boolean
  valueColor?: string
  negate?: boolean
}) {
  const display = negate ? Math.abs(value) : value
  return (
    <div className="flex items-center justify-between gap-4">
      <p
        className={`font-sans text-xs ${bold ? 'font-semibold' : 'text-muted-foreground'}`}
      >
        {sign && <span className="mr-1 font-sans">{sign}</span>}
        {label}
      </p>
      <p
        className={`font-sans text-xs ${bold ? 'font-semibold' : ''}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {formatCurrency(display)}
      </p>
    </div>
  )
}

function StatCell({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string
  value: string
  mono?: boolean
  valueColor?: string
}) {
  return (
    <div style={{ background: 'rgba(255,252,250,0.5)', border: '1px solid rgba(216,211,203,0.5)', borderRadius: 8, padding: 12 }}>
      <p className="font-sans text-[10px] tracking-wide uppercase text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`text-lg font-semibold ${mono ? 'font-sans' : 'font-sans'}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
