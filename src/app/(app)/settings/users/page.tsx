'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil, UserX, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { SettingsNav } from '@/components/layout/settings-nav'
import { cn } from '@/lib/utils'
import React from 'react'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  initials: string
  role: 'admin' | 'fee_earner' | 'assistant'
  isActive: boolean
  monthlyTargetCents: number | null
  createdAt: string
}

const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  initials: z
    .string()
    .min(2, 'Initials must be 2–3 characters')
    .max(3, 'Initials must be 2–3 characters')
    .regex(/^[A-Z]+$/, 'Initials must be uppercase letters only'),
  role: z.enum(['admin', 'fee_earner', 'assistant']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  isActive: z.boolean(),
  monthlyTarget: z.coerce.number().min(0).optional().nullable(),
})

const editUserSchema = createUserSchema.extend({
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, {
      message: 'Password must be at least 8 characters',
    }),
})

type CreateUserData = z.infer<typeof createUserSchema>
type EditUserData = z.infer<typeof editUserSchema>

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  fee_earner: 'Fee Earner',
  assistant: 'Assistant',
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
  overflow: 'hidden',
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-[hsl(var(--rose-100))] text-[hsl(var(--rose-700))] border-[hsl(var(--rose-200))]',
    fee_earner: 'bg-[hsl(var(--trust-100))] text-[hsl(var(--trust-700))] border-[hsl(var(--trust-200))]',
    assistant: 'bg-secondary text-foreground border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full font-sans text-[11px] tracking-wide border',
        styles[role] ?? styles.assistant,
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full font-sans text-[11px] tracking-wide border',
        isActive
          ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]'
          : 'bg-muted text-muted-foreground border-border',
      )}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

const fieldLabel: React.CSSProperties = {
  fontFamily: 'var(--font-noto-sans)',
  fontSize: 10,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: '#80796F',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(241,237,234,0.6)',
  border: '1px solid #D8D3CB',
  borderRadius: 8,
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(user)
  const schema = isEdit ? editUserSchema : createUserSchema

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EditUserData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          initials: user.initials,
          role: user.role,
          isActive: user.isActive,
          password: '',
          monthlyTarget: user.monthlyTargetCents != null ? user.monthlyTargetCents / 100 : undefined,
        }
      : {
          isActive: true,
          role: 'fee_earner',
        },
  })

  const onSubmit = async (data: EditUserData) => {
    try {
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        initials: data.initials,
        role: data.role,
        isActive: data.isActive,
        monthlyTargetCents: data.monthlyTarget != null ? Math.round(data.monthlyTarget * 100) : null,
      }

      if (!isEdit) {
        payload.email = data.email
        payload.password = data.password
      } else if (data.password) {
        payload.password = data.password
      }

      const url = isEdit ? `/api/users/${user!.id}` : '/api/users'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409) throw new Error('A user with this email address already exists')
        throw new Error(err.error || 'Failed to save user')
      }

      toast.success(isEdit ? 'User updated successfully' : 'User created successfully')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p style={fieldLabel}>First Name <span style={{ color: '#C0392B' }}>*</span></p>
            <Input {...register('firstName')} placeholder="Jessica" style={inputStyle} />
            {errors.firstName && (
              <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <p style={fieldLabel}>Last Name <span style={{ color: '#C0392B' }}>*</span></p>
            <Input {...register('lastName')} placeholder="Dolata" style={inputStyle} />
            {errors.lastName && (
              <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <p style={fieldLabel}>Email Address <span style={{ color: '#C0392B' }}>*</span></p>
          <Input
            {...register('email')}
            type="email"
            placeholder="j.dolata@dcco.law"
            disabled={isEdit}
            style={inputStyle}
          />
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
          {isEdit && (
            <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p style={fieldLabel}>Initials <span style={{ color: '#C0392B' }}>*</span></p>
            <Input
              {...register('initials')}
              placeholder="JD"
              className="uppercase"
              maxLength={3}
              style={inputStyle}
              onChange={(e) =>
                setValue('initials', e.target.value.toUpperCase())
              }
            />
            {errors.initials && (
              <p className="text-xs text-destructive mt-1">{errors.initials.message}</p>
            )}
          </div>
          <div>
            <p style={fieldLabel}>Role <span style={{ color: '#C0392B' }}>*</span></p>
            <Select
              value={watch('role')}
              onValueChange={(v) =>
                setValue('role', v as 'admin' | 'fee_earner' | 'assistant')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="fee_earner">Fee Earner</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p style={fieldLabel}>Password {!isEdit && <span style={{ color: '#C0392B' }}>*</span>}</p>
          <Input
            {...register('password')}
            type="password"
            placeholder={
              isEdit
                ? 'Leave blank to keep current password'
                : 'Minimum 8 characters'
            }
            autoComplete="new-password"
            style={inputStyle}
          />
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <p style={fieldLabel}>Monthly Target (ZAR)</p>
          <Input
            {...register('monthlyTarget')}
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 50000"
            style={inputStyle}
          />
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Leave blank for no target line on the fees chart.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-sm text-foreground">Active</p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Inactive users cannot sign in
            </p>
          </div>
          <Switch
            checked={watch('isActive')}
            onCheckedChange={(v) => setValue('isActive', v)}
          />
        </div>
      </div>

      <div className="border-t border-border p-6 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#80796F',
            background: 'transparent',
            border: '1px solid #D8D3CB',
            borderRadius: 40,
            padding: '10px 22px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: '#B08B82',
            borderRadius: 40,
            padding: '10px 22px',
            border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      toast.error('Access denied. Admin role required.')
      router.push('/dashboard')
      return
    }
    fetchUsers()
  }, [session, status, router, fetchUsers])

  const toggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(
        user.isActive
          ? `${user.firstName} ${user.lastName} deactivated`
          : `${user.firstName} ${user.lastName} reactivated`,
      )
      fetchUsers()
    } catch {
      toast.error('Failed to update user')
    }
  }

  const openCreate = () => {
    setEditingUser(null)
    setSheetOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setSheetOpen(true)
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

  return (
    <div>
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Settings
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Users
          </h1>
        </div>
        <button onClick={openCreate} style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 22px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          + New User
        </button>
      </div>

      <SettingsNav />

      <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS }}>
        <div className="overflow-x-auto">
          <table className="brand-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Initials</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-sans text-sm text-foreground">
                      {user.firstName} {user.lastName}
                    </p>
                  </td>
                  <td>
                    <p className="font-sans text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </td>
                  <td>
                    <span className="font-sans text-sm text-muted-foreground">
                      {user.initials}
                    </span>
                  </td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td>
                    <StatusBadge isActive={user.isActive} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label={`Edit ${user.firstName} ${user.lastName}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label={
                          user.isActive
                            ? `Deactivate ${user.firstName}`
                            : `Reactivate ${user.firstName}`
                        }
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <p className="font-sans text-sm text-muted-foreground">
                      No users found. Add your first user to get started.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User slide-over */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-light">
              {editingUser ? 'Edit User' : 'Add User'}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <UserForm
              key={editingUser?.id ?? 'new'}
              user={editingUser}
              onClose={() => setSheetOpen(false)}
              onSaved={fetchUsers}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
