'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Command } from 'cmdk'
import {
  FolderOpen,
  Users,
  Settings,
  Search,
  X,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface ClientResult {
  id: string
  clientCode: string
  clientName: string
  ficaStatus: string
  type: 'client'
}

interface MatterResult {
  id: string
  matterCode: string
  description: string
  clientCode: string
  clientName: string
  status: string
  type: 'matter'
}

interface SearchResults {
  clients: ClientResult[]
  matters: MatterResult[]
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[hsl(var(--rose-100))] text-[hsl(var(--rose-700))] rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(null)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        setResults(await res.json())
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, search])

  const runCommand = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const isAdmin = session?.user?.role === 'admin'
  const hasResults =
    results && (results.clients.length > 0 || results.matters.length > 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 max-w-[600px] bg-card border-border shadow-xl gap-0"
      >
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {/* Search input */}
          <div className="flex items-center border-b border-border px-4" cmdk-input-wrapper="">
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search matters, clients, actions…"
              className="flex h-12 w-full bg-transparent py-3 font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => setOpen(false)}
              className="ml-2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden py-2">
            {query.length >= 2 && loading && (
              <div className="px-4 py-6 text-center">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted rounded animate-pulse mx-4" />
                  ))}
                </div>
              </div>
            )}

            {query.length >= 2 && !loading && !hasResults && (
              <Command.Empty className="py-6 text-center font-sans text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </Command.Empty>
            )}

            {/* Clients */}
            {results && results.clients.length > 0 && (
              <Command.Group heading="Clients">
                {results.clients.map((client) => (
                  <Command.Item
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() =>
                      runCommand(() => router.push(`/clients/${client.id}`))
                    }
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer font-sans text-sm text-foreground hover:bg-secondary aria-selected:bg-secondary"
                  >
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-sans text-xs text-muted-foreground mr-1">
                      {highlight(client.clientCode, query)}
                    </span>
                    <span>{highlight(client.clientName, query)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Matters */}
            {results && results.matters.length > 0 && (
              <Command.Group heading="Matters">
                {results.matters.map((matter) => (
                  <Command.Item
                    key={matter.id}
                    value={`matter-${matter.id}`}
                    onSelect={() =>
                      runCommand(() => router.push(`/matters/${matter.id}`))
                    }
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer font-sans text-sm text-foreground hover:bg-secondary aria-selected:bg-secondary"
                  >
                    <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-sans text-xs text-muted-foreground flex-shrink-0">
                      {highlight(matter.matterCode, query)}
                    </span>
                    <span className="truncate flex-1">
                      {highlight(
                        matter.description.length > 50
                          ? matter.description.slice(0, 50) + '…'
                          : matter.description,
                        query,
                      )}
                    </span>
                    <span className="font-sans text-xs text-muted-foreground flex-shrink-0 ml-auto">
                      {matter.clientName}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions — always visible */}
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() =>
                  runCommand(() => router.push('/matters'))
                }
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer font-sans text-sm text-foreground hover:bg-secondary aria-selected:bg-secondary"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                New Matter
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  runCommand(() => router.push('/clients'))
                }
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer font-sans text-sm text-foreground hover:bg-secondary aria-selected:bg-secondary"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                New Client
              </Command.Item>
              {isAdmin && (
                <Command.Item
                  onSelect={() =>
                    runCommand(() => router.push('/settings'))
                  }
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer font-sans text-sm text-foreground hover:bg-secondary aria-selected:bg-secondary"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Go to Settings
                </Command.Item>
              )}
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2.5 flex items-center gap-3">
            <kbd className="font-sans text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              ↑↓
            </kbd>
            <span className="font-sans text-[11px] text-muted-foreground">navigate</span>
            <kbd className="font-sans text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              ↵
            </kbd>
            <span className="font-sans text-[11px] text-muted-foreground">select</span>
            <kbd className="font-sans text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Esc
            </kbd>
            <span className="font-sans text-[11px] text-muted-foreground">close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
