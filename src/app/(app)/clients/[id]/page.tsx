'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Upload, FileText, Download, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FicaBadge } from '@/components/ui/fica-badge'
import { MatterStatusBadge } from '@/components/ui/matter-status-badge'
import { ClientForm } from '@/components/clients/client-form'
import { formatEntityType } from '@/lib/entity-types'
import { formatCurrency, formatDate as fmtDate } from '@/lib/utils'
import { useSession } from 'next-auth/react'

interface ClientDetail {
  id: string
  clientCode: string
  clientName: string
  entityType: string
  ficaStatus: string
  ficaNotes: string | null
  ficaLastUpdatedAt: string | null
  isActive: boolean
  emailGeneral: string | null
  emailInvoices: string | null
  emailStatements: string | null
  tel: string | null
  mobile: string | null
  vatNumber: string | null
  physicalAddressLine1: string | null
  physicalAddressLine2: string | null
  physicalCity: string | null
  physicalProvince: string | null
  physicalPostalCode: string | null
  postalAddressLine1: string | null
  postalAddressLine2: string | null
  postalCity: string | null
  postalProvince: string | null
  postalPostalCode: string | null
  createdAt: string
  ficaDocuments: Array<{
    id: string
    documentType: string
    fileName: string
    fileSizeBytes: number | null
    uploadedAt: string
    uploadedBy: { firstName: string; lastName: string }
  }>
  matters: Array<{
    id: string
    matterCode: string
    description: string
    status: string
    dateOpened: string
    owner: { firstName: string; lastName: string; initials: string }
  }>
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Statement types ──────────────────────────────────────────────────────────

interface StatementEntry {
  date: string
  type: 'invoice' | 'receipt'
  reference: string
  description: string
  debitCents: number
  creditCents: number
  balanceCents: number
}

interface StatementData {
  entries: StatementEntry[]
  totals: { debitCents: number; creditCents: number; closingBalanceCents: number }
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'details')

  // Statement state
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [loadingStatement, setLoadingStatement] = useState(false)
  const [stmtFrom, setStmtFrom] = useState('')
  const [stmtTo, setStmtTo] = useState('')
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [ficaSheetOpen, setFicaSheetOpen] = useState(false)
  const [ficaStatus, setFicaStatus] = useState('')
  const [ficaNotes, setFicaNotes] = useState('')
  const [updatingFica, setUpdatingFica] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState('identity_document')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`)
      if (res.status === 404) {
        router.push('/clients')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load client')
      }
      const data = await res.json()
      setClient(data)
      setFicaStatus(data.ficaStatus)
      setFicaNotes(data.ficaNotes ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load client')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  const updateFicaStatus = async () => {
    setUpdatingFica(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ficaStatus, ficaNotes: ficaNotes || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('FICA status updated')
      setFicaSheetOpen(false)
      fetchClient()
    } catch {
      toast.error('Failed to update FICA status')
    } finally {
      setUpdatingFica(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
    if (file.size > MAX_SIZE) {
      toast.error('File is too large. Maximum size is 50 MB.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', uploadDocType)
      if (uploadNotes) formData.append('notes', uploadNotes)
      const res = await fetch(`/api/clients/${id}/fica-documents`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Upload failed')
      }
      toast.success('Document uploaded successfully')
      setUploadNotes('')
      fetchClient()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteFicaDoc = async (docId: string) => {
    if (!confirm('Delete this FICA document? This cannot be undone.')) return
    const res = await fetch(`/api/fica-documents/${docId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      toast.success('Document deleted')
      fetchClient()
    } else {
      toast.error('Failed to delete document')
    }
  }

  const loadStatement = async () => {
    setLoadingStatement(true)
    try {
      const params = new URLSearchParams()
      if (stmtFrom) params.set('from', stmtFrom)
      if (stmtTo) params.set('to', stmtTo)
      const res = await fetch(`/api/clients/${id}/statement?${params}`)
      if (res.ok) setStatement(await res.json())
      else toast.error('Failed to load statement')
    } finally {
      setLoadingStatement(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!client) return null

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/clients"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              color: 'rgba(241,237,234,0.50)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Clients
          </Link>
          <div>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
              Clients
            </p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
              {client.clientName}
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FicaBadge status={client.ficaStatus} />
          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: 'rgba(241,237,234,0.50)' }}>
            {formatEntityType(client.entityType)}
          </span>
          <button
            onClick={() => setEditSheetOpen(true)}
            style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 22px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Pencil style={{ width: 13, height: 13 }} />
            Edit
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="fade-up" style={{ animationDelay: '80ms', marginBottom: 24, marginTop: 8 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: 40, padding: '4px' }}>
          {[
            { id: 'details', label: 'Details' },
            { id: 'matters', label: `Matters (${client.matters.length})` },
            { id: 'statement', label: 'Statement' },
            { id: 'fica', label: 'FICA Documents' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                padding: '8px 18px',
                borderRadius: 36,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activeTab === tab.id ? '#B08B82' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#80796F',
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="fade-up" style={{ animationDelay: '160ms', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Contact Information */}
          <div style={GLASS}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 20, marginTop: 0 }}>
              Contact Information
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Email (General)', value: client.emailGeneral },
                { label: 'Email (Invoices)', value: client.emailInvoices },
                { label: 'Email (Statements)', value: client.emailStatements },
                { label: 'Telephone', value: client.tel },
                { label: 'Mobile', value: client.mobile },
                { label: 'VAT Number', value: client.vatNumber },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label}>
                    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 4, marginTop: 0 }}>
                      {label}
                    </p>
                    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', margin: 0 }}>{value}</p>
                  </div>
                ) : null,
              )}
              {!client.emailGeneral && !client.tel && !client.mobile && (
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', margin: 0 }}>
                  No contact details on record.
                </p>
              )}
            </div>
          </div>

          {/* Addresses */}
          <div style={GLASS}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 20, marginTop: 0 }}>
              Addresses
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {client.physicalAddressLine1 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 6, marginTop: 0 }}>
                    Physical Address
                  </p>
                  <div style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', lineHeight: 1.6 }}>
                    <p style={{ margin: 0 }}>{client.physicalAddressLine1}</p>
                    {client.physicalAddressLine2 && <p style={{ margin: 0 }}>{client.physicalAddressLine2}</p>}
                    {(client.physicalCity || client.physicalProvince) && (
                      <p style={{ margin: 0 }}>
                        {[client.physicalCity, client.physicalProvince].filter(Boolean).join(', ')}
                        {client.physicalPostalCode && ` ${client.physicalPostalCode}`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {client.postalAddressLine1 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 6, marginTop: 0 }}>
                    Postal Address
                  </p>
                  <div style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', lineHeight: 1.6 }}>
                    <p style={{ margin: 0 }}>{client.postalAddressLine1}</p>
                    {client.postalAddressLine2 && <p style={{ margin: 0 }}>{client.postalAddressLine2}</p>}
                    {(client.postalCity || client.postalProvince) && (
                      <p style={{ margin: 0 }}>
                        {[client.postalCity, client.postalProvince].filter(Boolean).join(', ')}
                        {client.postalPostalCode && ` ${client.postalPostalCode}`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!client.physicalAddressLine1 && !client.postalAddressLine1 && (
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic', margin: 0 }}>
                  No address on record.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Matters Tab */}
      {activeTab === 'matters' && (
        <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="brand-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Matter Code</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Date Opened</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {client.matters.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', margin: 0 }}>
                        No matters linked to this client yet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  client.matters.map((matter) => (
                    <tr
                      key={matter.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/matters/${matter.id}`)}
                    >
                      <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                        {matter.matterCode}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{matter.description}</span>
                      </td>
                      <td>
                        <MatterStatusBadge status={matter.status} />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                          {matter.owner.initials} — {matter.owner.firstName} {matter.owner.lastName}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                          {formatDate(matter.dateOpened)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <ArrowLeft style={{ width: 14, height: 14, color: '#80796F', transform: 'rotate(180deg)' }} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statement Tab */}
      {activeTab === 'statement' && (
        <div className="fade-up" style={{ animationDelay: '160ms', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Date filter */}
          <div style={{ ...GLASS, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-end', gap: 16 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 6, marginTop: 0 }}>
                From
              </p>
              <input
                type="date"
                value={stmtFrom}
                onChange={e => setStmtFrom(e.target.value)}
                style={{ height: 32, borderRadius: 8, border: '1px solid rgba(176,139,130,0.30)', background: 'rgba(255,255,255,0.70)', padding: '0 10px', fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#2C2C2A' }}
              />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 6, marginTop: 0 }}>
                To
              </p>
              <input
                type="date"
                value={stmtTo}
                onChange={e => setStmtTo(e.target.value)}
                style={{ height: 32, borderRadius: 8, border: '1px solid rgba(176,139,130,0.30)', background: 'rgba(255,255,255,0.70)', padding: '0 10px', fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#2C2C2A' }}
              />
            </div>
            <button
              onClick={loadStatement}
              disabled={loadingStatement}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 22px', border: 'none', cursor: loadingStatement ? 'not-allowed' : 'pointer', opacity: loadingStatement ? 0.7 : 1 }}
            >
              {loadingStatement ? 'Loading…' : statement ? 'Refresh' : 'Load Statement'}
            </button>
            {statement && (
              <a
                href={`/api/clients/${id}/statement/pdf${stmtFrom || stmtTo ? `?${new URLSearchParams({ ...(stmtFrom && { from: stmtFrom }), ...(stmtTo && { to: stmtTo }) })}` : ''}`}
                download
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#B08B82', border: '1px solid rgba(176,139,130,0.40)', borderRadius: 40, padding: '9px 18px', textDecoration: 'none' }}
              >
                <Download style={{ width: 14, height: 14 }} />
                PDF
              </a>
            )}
          </div>

          {!statement && !loadingStatement && (
            <div style={{ padding: '64px 0', textAlign: 'center', fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.08em', color: '#80796F' }}>
              Click &ldquo;Load Statement&rdquo; to view this client&apos;s account history
            </div>
          )}

          {statement && (
            <div style={{ ...GLASS, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="brand-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      {['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                          No transactions in this period
                        </td>
                      </tr>
                    ) : (
                      statement.entries.map((entry, i) => (
                        <tr key={i} style={{ background: entry.type === 'invoice' ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)' }}>
                          <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', whiteSpace: 'nowrap' as const }}>
                            {fmtDate(entry.date)}
                          </td>
                          <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>{entry.reference}</td>
                          <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{entry.description}</td>
                          <td style={{ fontFamily: 'var(--font-serif)', color: '#B08B82', textAlign: 'right' as const }}>
                            {entry.debitCents > 0 ? formatCurrency(entry.debitCents) : ''}
                          </td>
                          <td style={{ fontFamily: 'var(--font-serif)', color: '#22c55e', textAlign: 'right' as const }}>
                            {entry.creditCents > 0 ? formatCurrency(entry.creditCents) : ''}
                          </td>
                          <td style={{ fontFamily: 'var(--font-serif)', color: '#B08B82', textAlign: 'right' as const, fontWeight: 600 }}>
                            {formatCurrency(entry.balanceCents)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(176,139,130,0.20)', background: 'rgba(176,139,130,0.05)' }}>
                      <td colSpan={3} style={{ padding: '12px 24px', fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', fontWeight: 600 }}>
                        Totals
                      </td>
                      <td style={{ fontFamily: 'var(--font-serif)', fontSize: 15, textAlign: 'right' as const, fontWeight: 700, color: '#B08B82', padding: '12px 24px' }}>
                        {formatCurrency(statement.totals.debitCents)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-serif)', fontSize: 15, textAlign: 'right' as const, fontWeight: 700, color: '#22c55e', padding: '12px 24px' }}>
                        {formatCurrency(statement.totals.creditCents)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-serif)', fontSize: 15, textAlign: 'right' as const, fontWeight: 700, color: '#B08B82', padding: '12px 24px' }}>
                        {formatCurrency(statement.totals.closingBalanceCents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FICA Tab */}
      {activeTab === 'fica' && (
        <div className="fade-up" style={{ animationDelay: '160ms', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* FICA Compliance card */}
          <div style={GLASS}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', margin: 0 }}>
                  FICA Compliance
                </p>
                <FicaBadge status={client.ficaStatus} />
                {client.ficaNotes && (
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', maxWidth: '60ch', margin: 0 }}>{client.ficaNotes}</p>
                )}
                {client.ficaLastUpdatedAt && (
                  <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', margin: 0 }}>
                    Last updated: {formatDate(client.ficaLastUpdatedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setFicaSheetOpen(true)}
                style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 22px', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                Update FICA Status
              </button>
            </div>
          </div>

          {/* FICA Documents card */}
          <div style={GLASS}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', margin: 0 }}>
                FICA Documents
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Select value={uploadDocType} onValueChange={(v) => setUploadDocType(v ?? 'identity_document')}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identity_document">Identity Document</SelectItem>
                    <SelectItem value="proof_of_address">Proof of Address</SelectItem>
                    <SelectItem value="company_registration">Company Registration</SelectItem>
                    <SelectItem value="tax_clearance">Tax Clearance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '8px 18px', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Upload style={{ width: 12, height: 12 }} />
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                  }}
                />
              </div>
            </div>

            {client.ficaDocuments.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <FileText style={{ width: 32, height: 32, color: '#80796F', margin: '0 auto 8px' }} />
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', margin: 0 }}>
                  No FICA documents uploaded yet.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {client.ficaDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid rgba(176,139,130,0.15)' }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{doc.fileName}</p>
                      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', margin: 0 }}>
                        {doc.documentType.replace(/_/g, ' ')} •{' '}
                        {doc.fileSizeBytes
                          ? `${(doc.fileSizeBytes / 1024).toFixed(1)} KB`
                          : 'Unknown size'}{' '}
                        • Uploaded {formatDate(doc.uploadedAt)} by{' '}
                        {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <a
                        href={`/api/fica-documents/${doc.id}`}
                        download={doc.fileName}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: '#80796F', textDecoration: 'none', transition: 'background 0.15s' }}
                        title="Download"
                      >
                        <Download style={{ width: 14, height: 14 }} />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteFicaDoc(doc.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#80796F' }}
                          title="Delete"
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">Edit Client</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ClientForm
              key={client.id}
              client={client}
              onClose={() => setEditSheetOpen(false)}
              onSaved={() => {
                setEditSheetOpen(false)
                fetchClient()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* FICA Status Sheet */}
      <Sheet open={ficaSheetOpen} onOpenChange={setFicaSheetOpen}>
        <SheetContent className="w-full sm:max-w-sm p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">Update FICA Status</SheetTitle>
          </SheetHeader>
          <div className="p-6 space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                FICA Status
              </Label>
              <Select value={ficaStatus} onValueChange={(v) => setFicaStatus(v ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_compliant">Not Compliant</SelectItem>
                  <SelectItem value="partially_compliant">Partially Compliant</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Notes
              </Label>
              <textarea
                value={ficaNotes}
                onChange={(e) => setFicaNotes(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
          <div className="border-t border-border p-6 flex gap-3 justify-end flex-shrink-0">
            <button
              onClick={() => setFicaSheetOpen(false)}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#80796F', background: 'transparent', borderRadius: 40, padding: '10px 22px', border: '1px solid rgba(176,139,130,0.40)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={updateFicaStatus}
              disabled={updatingFica}
              style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 22px', border: 'none', cursor: updatingFica ? 'not-allowed' : 'pointer', opacity: updatingFica ? 0.7 : 1 }}
            >
              {updatingFica ? 'Saving…' : 'Save'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
