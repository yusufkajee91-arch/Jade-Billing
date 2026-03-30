'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const matterSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  description: z.string().min(1, 'Description is required'),
  ownerId: z.string().min(1, 'Owner is required'),
  matterTypeId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  matterCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type MatterFormData = z.infer<typeof matterSchema>

interface LookupUser {
  id: string
  firstName: string
  lastName: string
  initials: string
  role: string
}

interface LookupClient {
  id: string
  clientCode: string
  clientName: string
}

interface LookupItem {
  id: string
  name: string
}

interface MatterFormProps {
  matter?: {
    id: string
    matterCode: string
    description: string
    clientId: string
    ownerId: string
    matterTypeId: string | null
    departmentId: string | null
    notes: string | null
    status: string
  }
  initialClientId?: string
  onClose: () => void
  onSaved: (id: string) => void
}

export function MatterForm({ matter, initialClientId, onClose, onSaved }: MatterFormProps) {
  const { data: session } = useSession()
  const isEdit = Boolean(matter)

  const [clients, setClients] = useState<LookupClient[]>([])
  const [feeEarners, setFeeEarners] = useState<LookupUser[]>([])
  const [matterTypes, setMatterTypes] = useState<LookupItem[]>([])
  const [departments, setDepartments] = useState<LookupItem[]>([])
  const [allUsers, setAllUsers] = useState<LookupUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [clientSearch, setClientSearch] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MatterFormData>({
    resolver: zodResolver(matterSchema),
    defaultValues: matter
      ? {
          clientId: matter.clientId,
          description: matter.description,
          ownerId: matter.ownerId,
          matterTypeId: matter.matterTypeId,
          departmentId: matter.departmentId,
          notes: matter.notes,
        }
      : {
          clientId: initialClientId ?? '',
          ownerId: session?.user?.id ?? '',
        },
  })

  useEffect(() => {
    const fetchLookups = async () => {
      const [clientsRes, feRes, mtRes, deptRes, usersRes] = await Promise.all([
        fetch('/api/lookup?type=clients'),
        fetch('/api/lookup?type=fee-earners'),
        fetch('/api/lookup?type=matter-types'),
        fetch('/api/lookup?type=departments'),
        fetch('/api/lookup?type=users'),
      ])
      if (clientsRes.ok) setClients(await clientsRes.json())
      if (feRes.ok) setFeeEarners(await feRes.json())
      if (mtRes.ok) setMatterTypes(await mtRes.json())
      if (deptRes.ok) setDepartments(await deptRes.json())
      if (usersRes.ok) setAllUsers(await usersRes.json())
    }
    fetchLookups()
  }, [])

  // Set default owner to current user
  useEffect(() => {
    if (!isEdit && session?.user?.id && !watch('ownerId')) {
      setValue('ownerId', session.user.id)
    }
  }, [session, isEdit, setValue, watch])

  const watchClientId = watch('clientId')
  const watchOwnerId = watch('ownerId')

  const selectedClient = clients.find((c) => c.id === watchClientId)
  const selectedOwner = feeEarners.find((u) => u.id === watchOwnerId)

  const matterCodePreview =
    selectedClient && selectedOwner && !isEdit
      ? `${selectedOwner.initials}/${selectedClient.clientCode}-??? (auto-generated)`
      : undefined

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const filteredClients = clients.filter((c) => {
    if (!clientSearch) return true
    const q = clientSearch.toLowerCase()
    return c.clientCode.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q)
  })

  const onSubmit = async (data: MatterFormData) => {
    try {
      const payload = {
        ...data,
        matterTypeId: data.matterTypeId || null,
        departmentId: data.departmentId || null,
        matterCode: data.matterCode?.trim() || undefined,
        userIds: selectedUserIds,
      }

      const url = isEdit ? `/api/matters/${matter!.id}` : '/api/matters'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save matter')
      }

      const saved = await res.json()
      toast.success(isEdit ? 'Matter updated' : 'Matter created')
      onSaved(saved.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save matter')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Client */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Client <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="Search clients…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="mb-1"
          />
          <Select
            value={watch('clientId')}
            onValueChange={(v) => setValue('clientId', v ?? '')}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {filteredClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-sans text-xs text-muted-foreground mr-2">
                    {c.clientCode}
                  </span>
                  {c.clientName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.clientId && (
            <p className="text-xs text-destructive">{errors.clientId.message}</p>
          )}
        </div>

        {/* Owner */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Owner (Fee Earner) <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('ownerId')}
            onValueChange={(v) => setValue('ownerId', v ?? '')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {feeEarners.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  <span className="font-sans text-xs text-muted-foreground mr-2">
                    {u.initials}
                  </span>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.ownerId && (
            <p className="text-xs text-destructive">{errors.ownerId.message}</p>
          )}
        </div>

        {/* Matter Code */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Matter Code
          </Label>
          {!isEdit && matterCodePreview && (
            <p className="font-sans text-xs text-muted-foreground italic">
              {matterCodePreview}
            </p>
          )}
          {isEdit ? (
            <Input value={matter?.matterCode} disabled className="font-sans" />
          ) : (
            <Input
              {...register('matterCode')}
              placeholder="Leave blank to auto-generate"
              className="font-sans"
            />
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Description <span className="text-destructive">*</span>
          </Label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Brief description of the matter…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <Separator />

        {/* Matter Type */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Matter Type
          </Label>
          <Select
            value={watch('matterTypeId') ?? ''}
            onValueChange={(v) => setValue('matterTypeId', v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— None —</SelectItem>
              {matterTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Department
          </Label>
          <Select
            value={watch('departmentId') ?? ''}
            onValueChange={(v) => setValue('departmentId', v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— None —</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Users with Access */}
        <div className="space-y-2">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Additional Users with Access
          </Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {allUsers
              .filter((u) => u.id !== watchOwnerId)
              .map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={() => toggleUser(user.id)}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="font-sans text-sm text-foreground cursor-pointer"
                  >
                    <span className="font-sans text-xs text-muted-foreground mr-1.5">
                      {user.initials}
                    </span>
                    {user.firstName} {user.lastName}
                  </label>
                </div>
              ))}
          </div>
        </div>

        <Separator />

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
            Notes
          </Label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Internal notes about this matter…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
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
          {isSubmitting ? 'Saving…' : isEdit ? 'Update Matter' : 'Create Matter'}
        </Button>
      </div>
    </form>
  )
}
