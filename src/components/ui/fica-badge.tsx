type FicaStatus = 'not_compliant' | 'partially_compliant' | 'compliant'

interface Config {
  label: string
  background: string
  color: string
  border: string
}

const CONFIG: Record<FicaStatus, Config> = {
  not_compliant: {
    label: 'Not Compliant',
    background: '#9A3A3A',
    color: '#ffffff',
    border: 'none',
  },
  partially_compliant: {
    label: 'Partially Compliant',
    background: '#A07030',
    color: '#ffffff',
    border: 'none',
  },
  compliant: {
    label: 'Compliant',
    background: '#4A7C59',
    color: '#ffffff',
    border: 'none',
  },
}

interface FicaBadgeProps {
  status: FicaStatus | string
}

export function FicaBadge({ status }: FicaBadgeProps) {
  const config = CONFIG[status as FicaStatus] ?? CONFIG.not_compliant
  return (
    <span
      style={{
        display: 'inline-block',
        background: config.background,
        color: config.color,
        border: config.border,
        borderRadius: 20,
        padding: '4px 12px',
        fontFamily: 'var(--font-noto-sans)',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      {config.label}
    </span>
  )
}
