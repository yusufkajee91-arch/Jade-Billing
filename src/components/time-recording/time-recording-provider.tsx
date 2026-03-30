'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface TimeRecordingContextValue {
  open: (matterId?: string) => void
  close: () => void
  isOpen: boolean
  defaultMatterId: string | undefined
}

const TimeRecordingContext = createContext<TimeRecordingContextValue | null>(null)

export function useTimeRecording() {
  const ctx = useContext(TimeRecordingContext)
  if (!ctx) throw new Error('useTimeRecording must be used within TimeRecordingProvider')
  return ctx
}

export function TimeRecordingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultMatterId, setDefaultMatterId] = useState<string | undefined>()

  const open = useCallback((matterId?: string) => {
    setDefaultMatterId(matterId)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setDefaultMatterId(undefined)
  }, [])

  // Keyboard shortcut: T opens slide-over when not in an input/textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      e.preventDefault()
      open()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <TimeRecordingContext.Provider value={{ open, close, isOpen, defaultMatterId }}>
      {children}
    </TimeRecordingContext.Provider>
  )
}
