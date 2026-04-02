'use client'

import { useTimeRecording } from './time-recording-provider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FeeEntryForm } from './fee-entry-form'
import type { Session } from 'next-auth'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('FeeEntrySlideOver')

interface FeeEntrySlideOverProps {
  session: Session
  onSaved?: () => void
}

export function FeeEntrySlideOver({ session, onSaved }: FeeEntrySlideOverProps) {
  const { isOpen, close, defaultMatterId } = useTimeRecording()

  log.debug('FeeEntrySlideOver rendered', { isOpen, defaultMatterId, sessionUser: session?.user?.id })

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 py-5 border-b border-border flex-shrink-0">
          <SheetTitle className="font-serif text-xl font-light">Record Time</SheetTitle>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">
            Press <kbd className="font-sans bg-secondary px-1 rounded">T</kbd> to open from
            anywhere
          </p>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          {isOpen && (
            <FeeEntryForm
              defaultMatterId={defaultMatterId}
              session={{ user: { id: session.user.id!, role: session.user.role!, initials: session.user.initials! } }}
              onClose={close}
              onSaved={() => {
                onSaved?.()
              }}
              stayOpenAfterSave={true}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
