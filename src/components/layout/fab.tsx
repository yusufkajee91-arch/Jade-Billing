'use client'

import { Clock } from 'lucide-react'
import { useTimeRecording } from '@/components/time-recording/time-recording-provider'

export function FAB() {
  const { open } = useTimeRecording()

  return (
    <button
      onClick={() => open()}
      className="fixed bottom-8 right-8 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-lg hover:bg-[hsl(5_20%_50%)] transition-all hover:-translate-y-0.5 active:translate-y-0"
      aria-label="Record time"
    >
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span className="font-sans text-xs font-medium tracking-widest uppercase hidden sm:inline">
        Record Time
      </span>
    </button>
  )
}
