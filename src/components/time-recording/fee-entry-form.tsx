'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Calculator } from 'lucide-react'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('FeeEntryForm')
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseTimeToMinutes, formatMinutes } from '@/lib/time-parser'
import { roundToBillingBlock, calcTimeAmount, calcDiscount } from '@/lib/billing-blocks'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Matter {
  id: string
  matterCode: string
  description: string
  client: { clientName: string }
}

interface User {
  id: string
  initials: string
  firstName: string
  lastName: string
  defaultFeeLevelId: string | null
}

interface FeeLevel {
  id: string
  name: string
  hourlyRateCents: number
}

interface PostingCode {
  id: string
  code: string
  description: string
  defaultBillable: boolean
}

interface ExistingEntry {
  id: string
  matterId: string
  entryType: 'time' | 'unitary' | 'disbursement'
  entryDate: string
  narration: string
  durationMinutesRaw: number | null
  unitQuantityThousandths: number | null
  rateCents: number
  discountPct: number
  isBillable: boolean
  postingCodeId: string | null
  feeEarnerId: string
}

interface FeeEntryFormProps {
  // If provided, the matter selector is hidden and this matter is used
  defaultMatterId?: string
  // If provided, the form is in edit mode
  existingEntry?: ExistingEntry
  session: { user: { id: string; role: string; initials: string } }
  onClose: () => void
  onSaved: () => void
  // Keep slide-over open after save for rapid entry
  stayOpenAfterSave?: boolean
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  matterId: z.string().min(1, 'Matter is required'),
  entryType: z.enum(['time', 'unitary', 'disbursement']),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  narration: z.string().min(1, 'Narration is required'),
  timeInput: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  unitQty: z.string().optional(),
  rateCents: z.number().int().min(0),
  discountPct: z.number().int().min(0).max(100),
  isBillable: z.boolean(),
  postingCodeId: z.string().optional().nullable(),
  feeEarnerId: z.string().min(1),
  addToNotes: z.boolean(),
})

type FormData = z.infer<typeof schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeeEntryForm({
  defaultMatterId,
  existingEntry,
  session,
  onClose,
  onSaved,
  stayOpenAfterSave = false,
}: FeeEntryFormProps) {
  const isEdit = Boolean(existingEntry)

  log.info('FeeEntryForm rendered', { isEdit, defaultMatterId, stayOpenAfterSave })

  const [matters, setMatters] = useState<Matter[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [feeLevels, setFeeLevels] = useState<FeeLevel[]>([])
  const [postingCodes, setPostingCodes] = useState<PostingCode[]>([])
  const [billingBlocksEnabled, setBillingBlocksEnabled] = useState(true)
  const [matterSearch, setMatterSearch] = useState('')
  const [scheduleItems, setScheduleItems] = useState<{ id: string; description: string; professionalFeeCents: number; section: string }[]>([])
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [parsedMinutes, setParsedMinutes] = useState<number | null>(null)
  const [billedMinutes, setBilledMinutes] = useState<number | null>(null)
  const [previewAmount, setPreviewAmount] = useState(0)
  const [previewDiscount, setPreviewDiscount] = useState(0)
  const [previewTotal, setPreviewTotal] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existingEntry
      ? {
          matterId: existingEntry.matterId,
          entryType: existingEntry.entryType,
          entryDate: existingEntry.entryDate.slice(0, 10),
          narration: existingEntry.narration,
          timeInput: existingEntry.durationMinutesRaw
            ? `${existingEntry.durationMinutesRaw}`
            : undefined,
          unitQty: existingEntry.unitQuantityThousandths
            ? (existingEntry.unitQuantityThousandths / 1000).toString()
            : undefined,
          rateCents: existingEntry.rateCents,
          discountPct: existingEntry.discountPct,
          isBillable: existingEntry.isBillable,
          postingCodeId: existingEntry.postingCodeId ?? undefined,
          feeEarnerId: existingEntry.feeEarnerId,
          addToNotes: false,
        }
      : {
          matterId: defaultMatterId ?? '',
          entryType: 'time',
          entryDate: todayISO(),
          narration: '',
          rateCents: 0,
          discountPct: 0,
          isBillable: true,
          feeEarnerId: session.user.id,
          addToNotes: false,
        },
  })

  const watchedType = watch('entryType')
  const watchedRate = watch('rateCents')
  const watchedDiscount = watch('discountPct')
  const watchedTimeInput = watch('timeInput')
  const watchedUnitQty = watch('unitQty')
  const watchedFeeEarner = watch('feeEarnerId')

  // Load lookup data
  useEffect(() => {
    log.info('Loading lookup data for fee entry form')
    Promise.all([
      fetch('/api/matters?active=true').then((r) => { log.debug('Matters response status:', r.status); return r.json() }),
      fetch('/api/users').then((r) => { log.debug('Users response status:', r.status); return r.json() }),
      fetch('/api/lookup?type=fee_levels').then((r) => { log.debug('Fee levels response status:', r.status); return r.json() }),
      fetch('/api/lookup?type=posting_codes').then((r) => { log.debug('Posting codes response status:', r.status); return r.json() }),
      fetch('/api/firm-settings').then((r) => { log.debug('Firm settings response status:', r.status); return r.json() }),
    ]).then(([mattersData, usersData, feeLevelsData, postingCodesData, firmData]) => {
      log.info('Lookup data loaded:', {
        matters: Array.isArray(mattersData?.matters ?? mattersData) ? (mattersData?.matters ?? mattersData).length : 'not array',
        users: Array.isArray(usersData?.users ?? usersData) ? (usersData?.users ?? usersData).length : 'not array',
        feeLevels: Array.isArray(feeLevelsData) ? feeLevelsData.length : 'not array',
        postingCodes: Array.isArray(postingCodesData) ? postingCodesData.length : 'not array',
        billingBlocksEnabled: firmData?.billingBlocksEnabled,
      })
      setMatters(mattersData?.matters ?? mattersData ?? [])
      setUsers(usersData?.users ?? usersData ?? [])
      setFeeLevels(feeLevelsData ?? [])
      setPostingCodes(postingCodesData ?? [])
      setBillingBlocksEnabled(firmData?.billingBlocksEnabled ?? true)
    }).catch((error) => {
      log.error('Failed to load lookup data:', error)
    })

    // Load all fee schedule items for quick lookup
    fetch('/api/fee-schedules')
      .then((r) => r.ok ? r.json() : [])
      .then(async (cats: { id: string }[]) => {
        const allItems: { id: string; description: string; professionalFeeCents: number; section: string }[] = []
        for (const cat of cats) {
          const groups: { section: string; items: { id: string; description: string; professionalFeeCents: number; section: string; isActive: boolean }[] }[] = await fetch(`/api/fee-schedules/${cat.id}/items`).then((r) => r.json()).catch(() => [])
          for (const g of groups) {
            for (const item of g.items) {
              if (item.isActive) allItems.push({ id: item.id, description: item.description, professionalFeeCents: item.professionalFeeCents, section: g.section })
            }
          }
        }
        setScheduleItems(allItems)
      })
      .catch(() => {})
  }, [])

  // Auto-populate rate from fee earner's default fee level
  useEffect(() => {
    if (watchedType !== 'time' && watchedType !== 'unitary') return
    if (isEdit) return
    const user = users.find((u) => u.id === watchedFeeEarner)
    if (!user?.defaultFeeLevelId) return
    const level = feeLevels.find((fl) => fl.id === user.defaultFeeLevelId)
    if (level) setValue('rateCents', level.hourlyRateCents)
  }, [watchedFeeEarner, users, feeLevels, watchedType, isEdit, setValue])

  // Parse time input and update preview
  const recalcPreview = useCallback(() => {
    const type = watchedType
    const rate = watchedRate ?? 0
    const discPct = watchedDiscount ?? 0

    let amount = 0
    let rawMins: number | null = null
    let billedMins: number | null = null

    if (type === 'time') {
      rawMins = parseTimeToMinutes(watchedTimeInput ?? '')
      if (rawMins !== null) {
        billedMins = billingBlocksEnabled ? roundToBillingBlock(rawMins) : rawMins
        amount = calcTimeAmount(billedMins, rate)
      }
    } else if (type === 'unitary') {
      const qty = parseFloat(watchedUnitQty ?? '0') || 0
      amount = Math.round(qty * rate)
    } else {
      amount = rate
    }

    const discount = calcDiscount(amount, discPct)
    setParsedMinutes(rawMins)
    setBilledMinutes(billedMins)
    setPreviewAmount(amount)
    setPreviewDiscount(discount)
    setPreviewTotal(amount - discount)
  }, [watchedType, watchedRate, watchedDiscount, watchedTimeInput, watchedUnitQty, billingBlocksEnabled])

  useEffect(() => {
    recalcPreview()
  }, [recalcPreview])

  // Calculate minutes from start/end time
  const calcFromStartEnd = () => {
    const start = watch('startTime') ?? ''
    const end = watch('endTime') ?? ''
    if (!start || !end) return
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins > 0) setValue('timeInput', String(mins))
  }

  const onSubmit = async (data: FormData) => {
    log.info('Submitting fee entry', { entryType: data.entryType, matterId: data.matterId, isEdit })
    // Parse quantities for submission
    const rawMins = data.entryType === 'time' ? parseTimeToMinutes(data.timeInput ?? '') : null
    const unitQtyThousandths =
      data.entryType === 'unitary'
        ? Math.round((parseFloat(data.unitQty ?? '0') || 0) * 1000)
        : null

    const payload = {
      matterId: data.matterId,
      entryType: data.entryType,
      entryDate: data.entryDate,
      narration: data.narration,
      durationMinutesRaw: rawMins,
      unitQuantityThousandths: unitQtyThousandths,
      rateCents: data.rateCents,
      discountPct: data.discountPct,
      isBillable: data.isBillable,
      postingCodeId: data.postingCodeId ?? null,
      feeEarnerId: data.feeEarnerId,
      addToNotes: data.addToNotes,
    }

    const url = isEdit ? `/api/fee-entries/${existingEntry!.id}` : '/api/fee-entries'
    const method = isEdit ? 'PATCH' : 'POST'

    log.debug('Submitting to:', url, 'method:', method)
    log.debug('Payload:', payload)

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      log.error('Fee entry save failed:', { status: res.status, error: err })
      throw new Error(err.error || 'Failed to save entry')
    }

    log.info('Fee entry saved successfully')
    toast.success(isEdit ? 'Entry updated' : 'Entry recorded')
    onSaved()

    if (!isEdit && stayOpenAfterSave) {
      reset({
        matterId: data.matterId,
        entryType: data.entryType,
        entryDate: data.entryDate,
        narration: '',
        timeInput: '',
        unitQty: '',
        rateCents: data.rateCents,
        discountPct: 0,
        isBillable: true,
        feeEarnerId: data.feeEarnerId,
        addToNotes: false,
      })
    } else {
      onClose()
    }
  }

  const filteredMatters = matters.filter(
    (m) =>
      !matterSearch ||
      m.matterCode.toLowerCase().includes(matterSearch.toLowerCase()) ||
      m.description.toLowerCase().includes(matterSearch.toLowerCase()) ||
      m.client.clientName.toLowerCase().includes(matterSearch.toLowerCase()),
  )

  return (
    <form
      onSubmit={handleSubmit(async (d) => {
        try {
          await onSubmit(d)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to save entry')
        }
      })}
      className="flex flex-col h-full"
      noValidate
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Entry Type Selector */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Entry Type
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['time', 'unitary', 'disbursement'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setValue('entryType', type)}
                className={`py-2 px-3 rounded font-sans text-xs tracking-wide uppercase border transition-colors ${
                  watchedType === type
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-input text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'time' ? 'Time' : type === 'unitary' ? 'Unitary' : 'Disbursement'}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Matter selector (hidden when defaultMatterId provided) */}
        {!defaultMatterId && (
          <div className="space-y-2">
            <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Matter <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Search matters…"
              value={matterSearch}
              onChange={(e) => setMatterSearch(e.target.value)}
            />
            {errors.matterId && (
              <p className="text-xs text-destructive">{errors.matterId.message}</p>
            )}
            {matterSearch && (
              <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
                {filteredMatters.length === 0 ? (
                  <p className="p-3 font-sans text-sm text-muted-foreground">No matters found</p>
                ) : (
                  filteredMatters.slice(0, 10).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setValue('matterId', m.id)
                        setMatterSearch(`${m.matterCode} — ${m.client.clientName}`)
                      }}
                      className={`w-full text-left px-3 py-2 font-sans text-sm hover:bg-secondary transition-colors ${
                        watch('matterId') === m.id ? 'bg-secondary' : ''
                      }`}
                    >
                      <span className="font-sans text-xs mr-2 text-muted-foreground">
                        {m.matterCode}
                      </span>
                      {m.description}
                      <span className="text-xs text-muted-foreground ml-1">
                        — {m.client.clientName}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Date & Fee Earner */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input type="date" {...register('entryDate')} />
            {errors.entryDate && (
              <p className="text-xs text-destructive">{errors.entryDate.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Fee Earner
            </Label>
            <Select
              value={watchedFeeEarner ?? ''}
              onValueChange={(v) => setValue('feeEarnerId', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select earner" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => u.id === session.user.id || session.user.role === 'admin')
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="font-sans mr-2">{u.initials}</span>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Narration */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Narration <span className="text-destructive">*</span>
          </Label>
          <textarea
            {...register('narration')}
            rows={3}
            placeholder="Describe the work done…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          {errors.narration && (
            <p className="text-xs text-destructive">{errors.narration.message}</p>
          )}
        </div>

        {/* Time-specific fields */}
        {watchedType === 'time' && (
          <>
            <Separator />
            <div>
              <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
                Duration
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                    Time
                  </Label>
                  <Input
                    {...register('timeInput')}
                    placeholder="e.g. 90, 1h30, 1.5h, 1:30"
                  />
                  {parsedMinutes !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatMinutes(parsedMinutes)} entered
                      {billingBlocksEnabled && billedMinutes !== parsedMinutes && (
                        <span className="ml-1">
                          → <span className="font-sans">{formatMinutes(billedMinutes!)}</span> billed
                          (6-min blocks)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                      Start
                    </Label>
                    <Input type="time" {...register('startTime')} />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                      End
                    </Label>
                    <Input type="time" {...register('endTime')} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={calcFromStartEnd}
                    className="font-sans text-xs tracking-wide uppercase"
                  >
                    <Calculator className="h-3 w-3 mr-1" />
                    Calc
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Unitary-specific fields */}
        {watchedType === 'unitary' && (
          <>
            <Separator />
            {/* Fee schedule picker */}
            {scheduleItems.length > 0 && (
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  From Fee Schedule
                </Label>
                <Input
                  placeholder="Search schedule items…"
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                />
                {scheduleSearch && (
                  <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
                    {scheduleItems
                      .filter((i) => i.description.toLowerCase().includes(scheduleSearch.toLowerCase()) || i.section.toLowerCase().includes(scheduleSearch.toLowerCase()))
                      .slice(0, 12)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setValue('narration', item.description)
                            setValue('rateCents', item.professionalFeeCents)
                            setScheduleSearch('')
                          }}
                          className="w-full text-left px-3 py-2 font-sans text-sm hover:bg-secondary transition-colors"
                        >
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">{item.section}</span>
                          <span className="text-foreground">{item.description}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-sans">
                            R {(item.professionalFeeCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </span>
                        </button>
                      ))}
                    {scheduleItems.filter((i) => i.description.toLowerCase().includes(scheduleSearch.toLowerCase()) || i.section.toLowerCase().includes(scheduleSearch.toLowerCase())).length === 0 && (
                      <p className="p-3 font-sans text-sm text-muted-foreground">No items match</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Quantity
              </Label>
              <Input
                {...register('unitQty')}
                type="text"
                placeholder="e.g. 2.5"
              />
            </div>
          </>
        )}

        <Separator />

        {/* Financial */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Financial
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  {watchedType === 'time'
                    ? 'Hourly Rate (R)'
                    : watchedType === 'unitary'
                    ? 'Rate per Unit (R)'
                    : 'Amount (R)'}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-foreground">
                    R
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={((watchedRate ?? 0) / 100).toFixed(2)}
                    onChange={(e) =>
                      setValue('rateCents', Math.round(parseFloat(e.target.value || '0') * 100))
                    }
                    className="pl-7 font-sans"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Discount %
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={watchedDiscount ?? 0}
                  onChange={(e) =>
                    setValue('discountPct', Math.min(100, Math.max(0, parseInt(e.target.value || '0'))))
                  }
                  className="font-sans"
                />
              </div>
            </div>

            {/* Amount preview */}
            <div className="bg-secondary rounded-md p-3 space-y-1.5">
              <div className="flex justify-between font-sans text-xs text-muted-foreground">
                <span>Amount</span>
                <span className="font-sans">{formatCurrency(previewAmount)}</span>
              </div>
              {previewDiscount > 0 && (
                <div className="flex justify-between font-sans text-xs text-muted-foreground">
                  <span>Discount ({watchedDiscount}%)</span>
                  <span className="font-sans text-destructive">−{formatCurrency(previewDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-sans text-sm font-medium text-foreground border-t border-border pt-1.5">
                <span>Total</span>
                <span className="font-sans">{formatCurrency(previewTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Options */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Posting Code
            </Label>
            <Select
              value={watch('postingCodeId') ?? ''}
              onValueChange={(v) => setValue('postingCodeId', v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {postingCodes.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>
                    <span className="font-sans mr-2">{pc.code}</span>
                    {pc.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans text-sm text-foreground">Billable</p>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">
                Include in client invoicing
              </p>
            </div>
            <Switch
              checked={watch('isBillable')}
              onCheckedChange={(v) => setValue('isBillable', v)}
            />
          </div>

          {!isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-to-notes"
                checked={watch('addToNotes')}
                onCheckedChange={(v) => setValue('addToNotes', v === true)}
              />
              <label
                htmlFor="add-to-notes"
                className="font-sans text-sm text-foreground cursor-pointer"
              >
                Also add narration as a matter note
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-6 flex gap-3 justify-end flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="font-sans text-xs tracking-wide uppercase"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase"
        >
          {isSubmitting
            ? 'Saving…'
            : isEdit
            ? 'Update Entry'
            : stayOpenAfterSave
            ? 'Save & Add Another'
            : 'Save Entry'}
        </Button>
      </div>
    </form>
  )
}
