'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SettingsNav } from '@/components/layout/settings-nav'
import { componentLogger } from '@/lib/debug'
import React from 'react'

const log = componentLogger('FeeLevelsPage')

interface FeeLevel {
  id: string
  name: string
  hourlyRateCents: number
  sortOrder: number
  isActive: boolean
  createdAt: string
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  hourlyRateCents: z.number().min(0, 'Rate must be non-negative'),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
  overflow: 'hidden',
}

const fieldLabel: React.CSSProperties = {
  fontFamily: 'var(--font-noto-sans)',
  fontSize: 10,
  letterSpacing: '0.10em',
  textTransform: 'uppercase' as const,
  color: '#80796F',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(241,237,234,0.6)',
  border: '1px solid #D8D3CB',
  borderRadius: 8,
}

function formatRate(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / hr`
}

function FeeLevelForm({
  feeLevel,
  onClose,
  onSaved,
}: {
  feeLevel: FeeLevel | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(feeLevel)
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: feeLevel
      ? { name: feeLevel.name, hourlyRateCents: feeLevel.hourlyRateCents / 100, sortOrder: feeLevel.sortOrder, isActive: feeLevel.isActive }
      : { isActive: true, sortOrder: 0 },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        hourlyRateCents: Math.round((data.hourlyRateCents as number) * 100),
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      }
      const url = isEdit ? `/api/fee-levels/${feeLevel!.id}` : '/api/fee-levels'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      toast.success(isEdit ? 'Fee level updated' : 'Fee level created')
      onSaved()
      onClose()
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div>
          <p style={fieldLabel}>Name <span style={{ color: '#C0392B' }}>*</span></p>
          <Input {...register('name')} placeholder="Senior Attorney" style={inputStyle} />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <p style={fieldLabel}>Hourly Rate (ZAR) <span style={{ color: '#C0392B' }}>*</span></p>
          <Input
            {...register('hourlyRateCents', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="850.00"
            style={inputStyle}
          />
          {errors.hourlyRateCents && <p className="text-xs text-destructive mt-1">{errors.hourlyRateCents.message}</p>}
        </div>
        <div>
          <p style={fieldLabel}>Sort Order</p>
          <Input {...register('sortOrder', { valueAsNumber: true })} type="number" min="0" placeholder="0" style={inputStyle} />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={watch('isActive') ?? true}
            onCheckedChange={(v) => setValue('isActive', v)}
          />
          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#3E3B36' }}>Active</span>
        </div>
      </div>
      <div className="p-6 border-t border-border flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-full font-sans text-sm text-white transition-opacity disabled:opacity-50"
          style={{ background: '#B08B82' }}
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Fee Level'}
        </button>
      </div>
    </form>
  )
}

export default function FeeLevelsPage() {
  log.info('render')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [feeLevels, setFeeLevels] = useState<FeeLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FeeLevel | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<FeeLevel | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'admin') router.push('/dashboard')
  }, [status, session, router])

  const load = useCallback(async () => {
    log.info('fetching fee levels')
    setLoading(true)
    try {
      const res = await fetch('/api/fee-levels')
      if (res.ok) {
        const data = await res.json()
        log.info('fee levels loaded', { count: data.length })
        setFeeLevels(data)
      } else {
        log.error('failed to fetch fee levels', { status: res.status })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (fl: FeeLevel) => {
    const res = await fetch(`/api/fee-levels/${fl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !fl.isActive }),
    })
    if (res.ok) {
      toast.success(fl.isActive ? 'Fee level deactivated' : 'Fee level activated')
      setConfirmDeactivate(null)
      load()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to update')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: 32 }}>
        <SettingsNav />
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <SettingsNav />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 4 }}>
            Settings
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#2C2C2A', margin: 0 }}>
            Fee Levels
          </h1>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-sans text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: '#B08B82' }}
        >
          <Plus className="h-4 w-4" />
          New Fee Level
        </button>
      </div>

      {/* Table */}
      <div style={GLASS}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(216,211,203,0.6)' }}>
              {['Name', 'Hourly Rate', 'Sort Order', 'Status', ''].map((h) => (
                <th key={h} style={{
                  fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: '#80796F', padding: '12px 16px', textAlign: 'left', fontWeight: 500,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feeLevels.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                  No fee levels configured yet.
                </td>
              </tr>
            )}
            {feeLevels.map((fl) => (
              <tr key={fl.id} style={{ borderBottom: '1px solid rgba(216,211,203,0.3)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{fl.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#B08B82', fontWeight: 500 }}>{formatRate(fl.hourlyRateCents)}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>{fl.sortOrder}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    fontFamily: 'var(--font-noto-sans)', fontSize: 11,
                    background: fl.isActive ? 'rgba(74,124,89,0.12)' : 'rgba(128,121,111,0.10)',
                    color: fl.isActive ? '#4A7C59' : '#80796F',
                  }}>
                    {fl.isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {fl.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setEditing(fl); setSheetOpen(true) }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeactivate(fl)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={fl.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {fl.isActive ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deactivation confirmation */}
      {confirmDeactivate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ ...GLASS, padding: 28, maxWidth: 400, width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#2C2C2A', marginBottom: 12 }}>
              {confirmDeactivate.isActive ? 'Deactivate' : 'Activate'} Fee Level?
            </p>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', marginBottom: 20, lineHeight: 1.6 }}>
              {confirmDeactivate.isActive
                ? `"${confirmDeactivate.name}" will no longer appear in dropdowns for new entries. Existing records are unaffected.`
                : `"${confirmDeactivate.name}" will be available again in dropdowns.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeactivate(confirmDeactivate)}
                className="px-5 py-2 rounded-full font-sans text-sm text-white"
                style={{ background: confirmDeactivate.isActive ? '#9A3A3A' : '#4A7C59' }}
              >
                {confirmDeactivate.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[420px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border">
            <SheetTitle className="font-serif font-light text-xl">
              {editing ? 'Edit Fee Level' : 'New Fee Level'}
            </SheetTitle>
          </SheetHeader>
          <FeeLevelForm
            feeLevel={editing}
            onClose={() => setSheetOpen(false)}
            onSaved={load}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
