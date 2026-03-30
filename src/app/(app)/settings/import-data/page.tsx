'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SettingsNav } from '@/components/layout/settings-nav'

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

const HEADER: React.CSSProperties = {
  background: 'rgba(74,72,69,0.92)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  padding: '20px 28px',
}

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-noto-sans)',
  fontSize: 13,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #D8D3CB',
  background: 'rgba(241,237,234,0.6)',
  color: '#3E3B36',
  width: '100%',
  maxWidth: 400,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2380796F' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
}

// ── Import type definitions ───────────────────────────────────────────────────

type ImportTypeKey = 'clients' | 'matters' | 'invoices' | 'unbilled-fees'

interface ImportTypeDef {
  label: string
  description: string
  endpoint: string
  warning: string
  resultRenderer: 'basic' | 'invoice' | 'unbilled'
  clearEndpoint?: string
}

const IMPORT_TYPES: Record<ImportTypeKey, ImportTypeDef> = {
  clients: {
    label: 'Clients (from LawPractice ZA)',
    description: 'Upload the client list Excel export from LawPractice ZA. Accepts .xlsx or .csv files.',
    endpoint: '/api/import/clients',
    warning: 'This will not overwrite existing clients — duplicates are skipped.',
    resultRenderer: 'basic',
  },
  matters: {
    label: 'Matters (from LawPractice ZA)',
    description: 'Upload the matter list Excel export. Import clients first to ensure proper matching.',
    endpoint: '/api/import/matters',
    warning: 'Duplicates are skipped. Unmatched clients will be created as minimal records.',
    resultRenderer: 'basic',
  },
  invoices: {
    label: 'Invoice History (from LawPractice ZA)',
    description: 'Upload the Invoiced Fees and Disbursements Excel export. Import clients and matters first.',
    endpoint: '/api/import/invoices',
    warning: 'Historical invoices are marked as sent and will not generate GL journal entries.',
    resultRenderer: 'invoice',
  },
  'unbilled-fees': {
    label: 'Unbilled Fees & Disbursements (from LawPractice ZA)',
    description: 'Upload the unbilled fees and disbursements Excel export. Import clients and matters first.',
    endpoint: '/api/import/unbilled-fees',
    warning: 'Duplicate entries (same matter, date, narration, amount) are skipped on re-import.',
    resultRenderer: 'unbilled',
    clearEndpoint: '/api/import/unbilled-fees',
  },
}

const IMPORT_TYPE_KEYS: ImportTypeKey[] = ['clients', 'matters', 'invoices', 'unbilled-fees']

// ── Result types ──────────────────────────────────────────────────────────────

interface BasicResult {
  imported: number
  skipped: number
  errors: string[]
  unmatched_clients?: string[]
}

interface InvoiceResult {
  invoices_imported: number
  line_items_imported: number
  skipped_no_matter: string[]
  skipped_duplicate: number
  errors: string[]
}

interface UnbilledResult {
  imported: number
  skipped_no_matter: string[]
  skipped_duplicate: number
  errors: string[]
}

type AnyResult = BasicResult | InvoiceResult | UnbilledResult

// ── Stat display helper ───────────────────────────────────────────────────────

function Stat({ value, label, color = '#27AE60' }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 22, color, margin: 0 }}>{value}</p>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#80796F', margin: 0 }}>
        {label}
      </p>
    </div>
  )
}

function MatterCodeList({ codes, label }: { codes: string[]; label: string }) {
  if (codes.length === 0) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, fontWeight: 600, color: '#E67E22', marginBottom: 4 }}>
        {label} ({codes.length}):
      </p>
      <ul style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', margin: 0, paddingLeft: 16, maxHeight: 160, overflow: 'auto' }}>
        {codes.map((code, idx) => <li key={idx}>{code}</li>)}
      </ul>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, fontWeight: 600, color: '#C0392B', marginBottom: 4 }}>
        Errors:
      </p>
      <ul style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#C0392B', margin: 0, paddingLeft: 16, maxHeight: 160, overflow: 'auto' }}>
        {errors.slice(0, 30).map((e, idx) => <li key={idx}>{e}</li>)}
        {errors.length > 30 && <li>...and {errors.length - 30} more</li>}
      </ul>
    </div>
  )
}

// ── Result renderers ──────────────────────────────────────────────────────────

function BasicResultPanel({ result }: { result: BasicResult }) {
  const hasDetails = result.errors.length > 0 || (result.unmatched_clients && result.unmatched_clients.length > 0)
  return (
    <>
      <div style={{ display: 'flex', gap: 24, marginBottom: hasDetails ? 12 : 0 }}>
        <Stat value={result.imported} label="Imported" />
        <Stat value={result.skipped} label="Skipped" color="#A09A90" />
      </div>
      {result.unmatched_clients && result.unmatched_clients.length > 0 && (
        <MatterCodeList codes={result.unmatched_clients} label="Clients created (no match found)" />
      )}
      <ErrorList errors={result.errors} />
    </>
  )
}

function InvoiceResultPanel({ result }: { result: InvoiceResult }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat value={result.invoices_imported} label="Invoices" />
        <Stat value={result.line_items_imported} label="Line Items" />
        <Stat value={result.skipped_duplicate} label="Duplicates Skipped" color="#A09A90" />
      </div>
      <MatterCodeList codes={result.skipped_no_matter} label="Skipped — matter code not found" />
      <ErrorList errors={result.errors} />
    </>
  )
}

function UnbilledResultPanel({ result }: { result: UnbilledResult }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat value={result.imported} label="Imported" />
        <Stat value={result.skipped_duplicate} label="Duplicates Skipped" color="#A09A90" />
      </div>
      <MatterCodeList codes={result.skipped_no_matter} label="Skipped — matter code not found" />
      <ErrorList errors={result.errors} />
    </>
  )
}

// ── Import panel ──────────────────────────────────────────────────────────────

function ImportPanel({ typeDef, resultKey }: { typeDef: ImportTypeDef; resultKey: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result, setResult] = useState<AnyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset file input when import type changes
  const lastKeyRef = useRef(resultKey)
  if (lastKeyRef.current !== resultKey) {
    lastKeyRef.current = resultKey
    setFileName(null)
    setResult(null)
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    setResult(null)
    setError(null)
  }

  const doImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    setUploading(true)
    setResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(typeDef.endpoint, { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Import failed')
        toast.error(data.error || 'Import failed')
        return
      }

      setResult(data)
      const count =
        'invoices_imported' in data ? data.invoices_imported :
        'imported' in data ? data.imported : 0
      toast.success(`Imported ${count} records`)
    } catch {
      setError('Network error — please try again')
      toast.error('Network error — please try again')
    } finally {
      setUploading(false)
    }
  }

  const handleClearAndReimport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    if (!typeDef.clearEndpoint) return
    if (!confirm('This will delete all previously imported historical unbilled entries, then re-import from the selected file. Continue?')) return

    setClearing(true)
    setResult(null)
    setError(null)

    try {
      const delRes = await fetch(typeDef.clearEndpoint, { method: 'DELETE' })
      const delData = await delRes.json()

      if (!delRes.ok) {
        setError(delData.error || 'Failed to clear entries')
        toast.error(delData.error || 'Failed to clear entries')
        return
      }

      toast.success(`Cleared ${delData.deleted} historical entries`)
    } catch {
      setError('Network error clearing entries')
      toast.error('Network error clearing entries')
      return
    } finally {
      setClearing(false)
    }

    // Now import
    await doImport()
  }

  const busy = uploading || clearing

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ height: 1, background: 'rgba(216,211,203,0.5)', marginBottom: 20 }} />

      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', marginBottom: 16 }}>
        {typeDef.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #D8D3CB',
            background: 'rgba(241,237,234,0.6)',
            cursor: 'pointer',
            color: '#3E3B36',
          }}
        >
          Choose File
          <input
            ref={fileRef}
            key={resultKey}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
          {fileName || 'No file selected'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={doImport}
          disabled={busy || !fileName}
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: busy || !fileName ? 'rgba(176,139,130,0.4)' : '#B08B82',
            color: '#fff',
            cursor: busy || !fileName ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          {uploading ? 'Importing...' : 'Import'}
        </button>

        {typeDef.clearEndpoint && (
          <button
            onClick={handleClearAndReimport}
            disabled={busy || !fileName}
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              padding: '10px 24px',
              borderRadius: 8,
              border: '1px solid #C0392B',
              background: busy || !fileName ? 'rgba(192,57,43,0.1)' : 'transparent',
              color: busy || !fileName ? 'rgba(192,57,43,0.4)' : '#C0392B',
              cursor: busy || !fileName ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {clearing ? 'Clearing...' : 'Clear & Re-import'}
          </button>
        )}
      </div>

      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#A09A90', marginTop: 12 }}>
        {typeDef.warning}
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'rgba(220,80,60,0.08)', border: '1px solid rgba(220,80,60,0.2)' }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#C0392B', margin: 0 }}>{error}</p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.18)' }}>
          {typeDef.resultRenderer === 'basic' && <BasicResultPanel result={result as BasicResult} />}
          {typeDef.resultRenderer === 'invoice' && <InvoiceResultPanel result={result as InvoiceResult} />}
          {typeDef.resultRenderer === 'unbilled' && <UnbilledResultPanel result={result as UnbilledResult} />}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportDataPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selected, setSelected] = useState<ImportTypeKey | ''>('')

  if (status === 'loading') {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>Loading...</p>
      </div>
    )
  }

  if (!session || session.user.role !== 'admin') {
    toast.error('Access denied. Admin role required.')
    router.push('/dashboard')
    return null
  }

  const typeDef = selected ? IMPORT_TYPES[selected] : null

  return (
    <div style={{ padding: '0 0 48px' }}>
      <div style={HEADER}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: '#FFFCFA', margin: 0 }}>
          Import Data
        </h1>
      </div>

      <div style={{ padding: '24px 0 0' }}>
        <SettingsNav />

        <div style={GLASS}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: '#2C2C2A', marginBottom: 16 }}>
            Select import type
          </h2>

          <select
            value={selected}
            onChange={e => setSelected(e.target.value as ImportTypeKey | '')}
            style={SELECT_STYLE}
          >
            <option value="">Choose an import type...</option>
            {IMPORT_TYPE_KEYS.map(key => (
              <option key={key} value={key}>{IMPORT_TYPES[key].label}</option>
            ))}
          </select>

          {typeDef && <ImportPanel typeDef={typeDef} resultKey={selected} />}
        </div>
      </div>
    </div>
  )
}
