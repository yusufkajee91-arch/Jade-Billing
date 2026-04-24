'use client'

import { useRouter } from 'next/navigation'
import { ClientForm } from '@/components/clients/client-form'

export function NewClientPage() {
  const router = useRouter()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex-shrink-0 border-b border-border px-6 py-5">
        <p className="font-sans text-xs uppercase text-muted-foreground">Practice</p>
        <h1 className="font-serif text-2xl font-light text-foreground">New Client</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ClientForm
          client={null}
          onClose={() => router.push('/clients')}
          onSaved={() => router.push('/clients')}
        />
      </div>
    </div>
  )
}
