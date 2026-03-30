import { cn } from '@/lib/utils'

type MatterStatus = 'open' | 'closed' | 'suspended'

const CONFIG: Record<MatterStatus, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className:
      'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(142_25%_39%_/_0.25)]',
  },
  closed: {
    label: 'Closed',
    className: 'bg-muted text-muted-foreground border-border',
  },
  suspended: {
    label: 'Suspended',
    className:
      'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))] border-[hsl(35_55%_40%_/_0.25)]',
  },
}

export function MatterStatusBadge({ status }: { status: MatterStatus | string }) {
  const config = CONFIG[status as MatterStatus] ?? CONFIG.closed
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full font-sans text-[11px] tracking-wide border',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
