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

const log = componentLogger('PostingCodesPage')

interface PostingCode {
  id: string
  code: string
  description: string
  defaultBillable: boolean
  sortOrder: number
  isActive: boolean
}

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  description: z.string().min(1, 'Description is required'),
  defaultBillable: z.boolean().optional(),
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

function PostingCodeForm({
  postingCode,
  onClose,
  onSaved,
}: {
  postingCode: PostingCode | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(postingCode)
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: postingCode
      ? { code: postingCode.code, description: postingCode.description, defaultBillable: postingCode.defaultBillable, sortOrder: postingCode.sortOrder, isActive: postingCode.isActive }
      : { defaultBillable: true, isActive: true, sortOrder: 0 },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, code: data.code.toUpperCase() }
      const url = isEdit ? `/api/posting-codes/${postingCode!.id}` : '/api/posting-codes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      toast.success(isEdit ? 'Posting code updated' : 'Posting code created')
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
          <p style={fieldLabel}>Code <span style={{ color: '#C0392B' }}>*</span></p>
          <Input
            {...register('code')}
            placeholder="PROF"
            className="uppercase"
            style={inputStyle}
            onChange={(e) => setValue('code', e.target.value.toUpperCase())}
          />
          {errors.code && <p className="text-xs text-destructive mt-1">{errors.code.message}</p>}
        </div>
        <div>
          <p style={fieldLabel}>Description <span style={{ color: '#C0392B' }}>*</span></p>
          <Input {...register('description')} placeholder="Professional Fees" style={inputStyle} />
          {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
        </div>
        <div>
          <p style={fieldLabel}>Sort Order</p>
          <Input {...register('sortOrder', { valueAsNumber: true })} type="number" min="0" placeholder="0" style={inputStyle} />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={watch('defaultBillable') ?? true}
            onCheckedChange={(v) => setValue('defaultBillable', v)}
          />
          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#3E3B36' }}>Billable by default</span>
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
          {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Posting Code'}
        </button>
      </div>
    </form>
  )
}

export default function PostingCodesPage() {
  log.info('render')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [postingCodes, setPostingCodes] = useState<PostingCode[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PostingCode | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<PostingCode | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'admin') router.push('/dashboard')
  }, [status, session, router])

  const load = useCallback(async () => {
    log.info('fetching posting codes')
    setLoading(true)
    try {
      const res = await fetch('/api/posting-codes')
      if (res.ok) {
        const data = await res.json()
        log.info('posting codes loaded', { count: data.length })
        setPostingCodes(data)
      } else {
        log.error('failed to fetch posting codes', { status: res.status })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (pc: PostingCode) => {
    const res = await fetch(`/api/posting-codes/${pc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !pc.isActive }),
    })
    if (res.ok) {
      toast.success(pc.isActive ? 'Posting code deactivated' : 'Posting code activated')
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 4 }}>
            Settings
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#2C2C2A', margin: 0 }}>
            Posting Codes
          </h1>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-sans text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: '#B08B82' }}
        >
          <Plus className="h-4 w-4" />
          New Posting Code
        </button>
      </div>

      <div style={GLASS}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(216,211,203,0.6)' }}>
              {['Code', 'Description', 'Billable Default', 'Sort', 'Status', ''].map((h) => (
                <th key={h} style={{
                  fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: '#80796F', padding: '12px 16px', textAlign: 'left', fontWeight: 500,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postingCodes.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                  No posting codes configured yet.
                </td>
              </tr>
            )}
            {postingCodes.map((pc) => (
              <tr key={pc.id} style={{ borderBottom: '1px solid rgba(216,211,203,0.3)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#B08B82', fontWeight: 600, letterSpacing: '0.05em' }}>{pc.code}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#2C2C2A' }}>{pc.description}</td>
                <td style={{ padding: '12px 16px' }}>
                  {pc.defaultBillable
                    ? <Check className="h-4 w-4" style={{ color: '#4A7C59' }} />
                    : <X className="h-4 w-4" style={{ color: '#80796F' }} />}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>{pc.sortOrder}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    fontFamily: 'var(--font-noto-sans)', fontSize: 11,
                    background: pc.isActive ? 'rgba(74,124,89,0.12)' : 'rgba(128,121,111,0.10)',
                    color: pc.isActive ? '#4A7C59' : '#80796F',
                  }}>
                    {pc.isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {pc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setEditing(pc); setSheetOpen(true) }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeactivate(pc)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={pc.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {pc.isActive ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDeactivate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ ...GLASS, padding: 28, maxWidth: 400, width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#2C2C2A', marginBottom: 12 }}>
              {confirmDeactivate.isActive ? 'Deactivate' : 'Activate'} Posting Code?
            </p>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', marginBottom: 20, lineHeight: 1.6 }}>
              {confirmDeactivate.isActive
                ? `"${confirmDeactivate.code}" will no longer appear in dropdowns for new entries. Existing records are unaffected.`
                : `"${confirmDeactivate.code}" will be available again in dropdowns.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeactivate(null)} className="px-4 py-2 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[420px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border">
            <SheetTitle className="font-serif font-light text-xl">
              {editing ? 'Edit Posting Code' : 'New Posting Code'}
            </SheetTitle>
          </SheetHeader>
          <PostingCodeForm
            postingCode={editing}
            onClose={() => setSheetOpen(false)}
            onSaved={load}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
