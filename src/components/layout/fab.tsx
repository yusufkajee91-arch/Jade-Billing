'use client'

import type { ReactNode } from 'react'
import { Clock, FilePlus2, Plus, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTimeRecording } from '@/components/time-recording/time-recording-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type QuickAction = {
  label: string
  icon: ReactNode
  onClick: () => void
  roles: string[]
}

const fabButtonClass =
  'flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[hsl(5_20%_50%)] active:translate-y-0'

export function FabGroup() {
  const router = useRouter()
  const { data: session } = useSession()
  const { open } = useTimeRecording()
  const role = session?.user?.role

  const actions: QuickAction[] = [
    {
      label: 'Add Client',
      icon: <UserPlus className="h-4 w-4 flex-shrink-0" />,
      onClick: () => router.push('/clients/new'),
      roles: ['admin', 'fee_earner'],
    },
    {
      label: 'Add Matter',
      icon: <FilePlus2 className="h-4 w-4 flex-shrink-0" />,
      onClick: () => router.push('/matters/new'),
      roles: ['admin', 'fee_earner'],
    },
    {
      label: 'Record Time',
      icon: <Clock className="h-4 w-4 flex-shrink-0" />,
      onClick: () => open(),
      roles: ['admin', 'fee_earner'],
    },
  ].filter((action) => role && action.roles.includes(role))

  if (actions.length === 0) return null

  return (
    <>
      <div className="fixed bottom-8 right-8 z-50 hidden flex-col items-end gap-2 sm:flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={fabButtonClass}
            aria-label={action.label === 'Record Time' ? 'Record time' : action.label}
          >
            {action.icon}
            <span className="font-sans text-xs font-medium uppercase">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="fixed bottom-6 right-6 z-50 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(fabButtonClass, 'h-12 w-12 px-0')}
            aria-label="Quick actions"
          >
            <Plus className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-48">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                onClick={action.onClick}
                className="cursor-pointer gap-2 px-3 py-2"
              >
                {action.icon}
                <span>{action.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

export const FAB = FabGroup
