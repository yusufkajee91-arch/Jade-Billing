'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('LoginPage')

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    log.info('Login attempt for:', data.email)
    setAuthError(null)
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      log.warn('Login failed:', result.error)
      setAuthError('Invalid email address or password. Please try again.')
    } else if (result?.ok) {
      log.info('Login successful, redirecting to dashboard')
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      {/* Card */}
      <div
        className="w-full max-w-[400px] bg-card rounded-[8px] shadow-lg border border-border px-10 py-10 mx-4"
      >
        {/* Firm header */}
        <div className="text-center mb-8">
          <h1
            className="font-serif text-[28px] font-medium text-foreground leading-tight"
          >
            Dolata &amp; Co
          </h1>
          <p className="font-sans text-[13px] tracking-widest uppercase text-muted-foreground mt-1">
            Billing System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@dcco.law"
              {...register('email')}
              className="bg-input border-border"
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-sans text-xs tracking-wide uppercase text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className="bg-input border-border"
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>

          {authError && (
            <div className="rounded-md bg-[hsl(var(--error-bg))] border border-destructive/20 px-4 py-3">
              <p className="text-xs text-destructive">{authError}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-[hsl(5_20%_50%)] text-primary-foreground font-sans text-xs tracking-widest uppercase mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>

      {/* Theme toggle — bottom right */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed bottom-6 right-6 p-2.5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Toggle colour scheme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  )
}
