'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ENTITY_TYPE_LABELS } from '@/lib/entity-types'

const clientSchema = z.object({
  clientCode: z.string().max(10).optional(),
  clientName: z.string().min(1, 'Client name is required'),
  entityType: z.enum([
    'individual_sa',
    'company_pty',
    'company_ltd',
    'close_corporation',
    'trust',
    'partnership',
    'foreign_company',
    'other',
  ]),
  vatNumber: z.string().optional().nullable(),
  isActive: z.boolean(),
  emailGeneral: z.string().email('Invalid email address').or(z.literal('')).optional().nullable(),
  emailInvoices: z.string().email('Invalid email address').or(z.literal('')).optional().nullable(),
  emailStatements: z.string().email('Invalid email address').or(z.literal('')).optional().nullable(),
  tel: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  physicalAddressLine1: z.string().optional().nullable(),
  physicalAddressLine2: z.string().optional().nullable(),
  physicalCity: z.string().optional().nullable(),
  physicalProvince: z.string().optional().nullable(),
  physicalPostalCode: z.string().optional().nullable(),
  postalAddressLine1: z.string().optional().nullable(),
  postalAddressLine2: z.string().optional().nullable(),
  postalCity: z.string().optional().nullable(),
  postalProvince: z.string().optional().nullable(),
  postalPostalCode: z.string().optional().nullable(),
  ficaStatus: z.enum(['not_compliant', 'partially_compliant', 'compliant']).optional(),
  ficaNotes: z.string().optional().nullable(),
})

type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormProps {
  client: {
    id: string
    clientCode: string
    clientName: string
    entityType: string
    ficaStatus: string
    isActive: boolean
    emailGeneral: string | null
    emailInvoices: string | null
    tel: string | null
    mobile: string | null
  } | null
  onClose: () => void
  onSaved: () => void
}

function autoGenerateCode(name: string): string {
  const words = name.trim().split(/\s+/)
  // Take first letter of each word, uppercase, strip non-alphanumeric, max 4 chars
  let code = words
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  // Guarantee at least 2 chars — pad with first 2 letters of first word if needed
  if (code.length < 2) {
    const firstWord = words[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''
    code = (code + firstWord).slice(0, 4)
  }
  return code || 'CLT'
}

export function ClientForm({ client, onClose, onSaved }: ClientFormProps) {
  const isEdit = Boolean(client)
  const [sameAsPhysical, setSameAsPhysical] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          clientCode: client.clientCode,
          clientName: client.clientName,
          entityType: client.entityType as ClientFormData['entityType'],
          isActive: client.isActive,
          emailGeneral: client.emailGeneral ?? '',
          emailInvoices: client.emailInvoices ?? '',
          ficaStatus: client.ficaStatus as ClientFormData['ficaStatus'],
        }
      : {
          isActive: true,
          ficaStatus: 'not_compliant',
        },
  })

  const watchPhysical = {
    line1: watch('physicalAddressLine1'),
    line2: watch('physicalAddressLine2'),
    city: watch('physicalCity'),
    province: watch('physicalProvince'),
    postalCode: watch('physicalPostalCode'),
  }

  const onSubmit = async (data: ClientFormData) => {
    try {
      // Auto-generate clientCode if blank
      let clientCode = data.clientCode?.trim().toUpperCase()
      if (!clientCode && !isEdit) {
        clientCode = autoGenerateCode(data.clientName)
      }

      if (sameAsPhysical) {
        data.postalAddressLine1 = watchPhysical.line1
        data.postalAddressLine2 = watchPhysical.line2
        data.postalCity = watchPhysical.city
        data.postalProvince = watchPhysical.province
        data.postalPostalCode = watchPhysical.postalCode
      }

      const payload = { ...data, clientCode: clientCode || data.clientCode }

      const url = isEdit ? `/api/clients/${client!.id}` : '/api/clients'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409) throw new Error('A client with this code already exists')
        throw new Error(err.error || 'Failed to save client')
      }

      toast.success(isEdit ? 'Client updated successfully' : 'Client created successfully')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full" noValidate>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Section 1: Identity */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Identity
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Client Code
                </Label>
                <Input
                  {...register('clientCode')}
                  placeholder="e.g. APS"
                  className="uppercase"
                  disabled={isEdit}
                  onChange={(e) =>
                    setValue('clientCode', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                  }
                />
                {!isEdit && (
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to auto-generate from name
                  </p>
                )}
                {errors.clientCode && (
                  <p className="text-xs text-destructive">{errors.clientCode.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  VAT Number
                </Label>
                <Input {...register('vatNumber')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input {...register('clientName')} placeholder="e.g. Aqua Plastech (Pty) Ltd" />
              {errors.clientName && (
                <p className="text-xs text-destructive">{errors.clientName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Entity Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('entityType') ?? ''}
                onValueChange={(v) =>
                  setValue('entityType', v as ClientFormData['entityType'])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.entityType && (
                <p className="text-xs text-destructive">{errors.entityType.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-sm text-foreground">Active</p>
                <p className="font-sans text-xs text-muted-foreground mt-0.5">
                  Inactive clients are hidden from dropdowns
                </p>
              </div>
              <Switch
                checked={watch('isActive')}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Contact Details */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Contact Details
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Email (General)
              </Label>
              <Input {...register('emailGeneral')} type="text" placeholder="info@client.co.za" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Email (Invoices)
              </Label>
              <Input {...register('emailInvoices')} type="text" placeholder="accounts@client.co.za" />
              <p className="text-[11px] text-muted-foreground">Leave blank to use general email</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Email (Statements)
              </Label>
              <Input {...register('emailStatements')} type="text" placeholder="statements@client.co.za" />
              <p className="text-[11px] text-muted-foreground">Leave blank to use general email</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Telephone
                </Label>
                <Input {...register('tel')} placeholder="+27 11 000 0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Mobile
                </Label>
                <Input {...register('mobile')} placeholder="+27 82 000 0000" />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 3: Physical Address */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Physical Address
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Address Line 1
              </Label>
              <Input {...register('physicalAddressLine1')} placeholder="123 Main Street" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                Address Line 2
              </Label>
              <Input {...register('physicalAddressLine2')} placeholder="Suburb" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  City
                </Label>
                <Input {...register('physicalCity')} placeholder="Johannesburg" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Province
                </Label>
                <Input {...register('physicalProvince')} placeholder="Gauteng" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                  Postal Code
                </Label>
                <Input {...register('physicalPostalCode')} placeholder="2000" />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 4: Postal Address */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            Postal Address
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="same-as-physical"
                checked={sameAsPhysical}
                onCheckedChange={(v) => setSameAsPhysical(v === true)}
              />
              <label
                htmlFor="same-as-physical"
                className="font-sans text-sm text-foreground cursor-pointer"
              >
                Same as physical address
              </label>
            </div>
            {!sameAsPhysical && (
              <>
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                    Address Line 1
                  </Label>
                  <Input {...register('postalAddressLine1')} placeholder="P.O. Box 123" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                    Address Line 2
                  </Label>
                  <Input {...register('postalAddressLine2')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                      City
                    </Label>
                    <Input {...register('postalCity')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                      Province
                    </Label>
                    <Input {...register('postalProvince')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                      Postal Code
                    </Label>
                    <Input {...register('postalPostalCode')} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Section 5: FICA */}
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
            FICA
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
                FICA Status
              </Label>
              <Select
                value={watch('ficaStatus') ?? 'not_compliant'}
                onValueChange={(v) =>
                  setValue('ficaStatus', v as ClientFormData['ficaStatus'])
                }
              >
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
                FICA Notes
              </Label>
              <textarea
                {...register('ficaNotes')}
                rows={3}
                placeholder="Notes about FICA compliance status…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
        </div>
      </div>

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
          {isSubmitting ? 'Saving…' : isEdit ? 'Update Client' : 'Create Client'}
        </Button>
      </div>
    </form>
  )
}
