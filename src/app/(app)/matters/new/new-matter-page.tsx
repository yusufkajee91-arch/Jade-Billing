'use client'

import { useRouter } from 'next/navigation'
import { MatterForm } from '@/components/matters/matter-form'

export function NewMatterPage() {
  const router = useRouter()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex-shrink-0 border-b border-border px-6 py-5">
        <p className="font-sans text-xs uppercase text-muted-foreground">Practice</p>
        <h1 className="font-serif text-2xl font-light text-foreground">New Matter</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <MatterForm
          onClose={() => router.push('/matters')}
          onSaved={(id) => router.push(`/matters/${id}`)}
        />
      </div>
    </div>
  )
}
