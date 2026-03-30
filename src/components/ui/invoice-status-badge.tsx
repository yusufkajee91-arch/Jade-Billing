interface InvoiceStatusBadgeProps {
  status: string
  invoiceType: string
}

const CONFIG: Record<string, { label: string; classes: string }> = {
  draft_pro_forma:  { label: 'Draft Pro Forma', classes: 'bg-secondary text-muted-foreground' },
  sent_pro_forma:   { label: 'Sent Pro Forma',  classes: 'bg-[hsl(225_28%_92%)] text-[hsl(225_28%_40%)]' },
  draft_invoice:    { label: 'Draft Invoice',   classes: 'bg-[hsl(33_40%_92%)] text-[hsl(33_40%_40%)]' },
  sent_invoice:     { label: 'Sent',            classes: 'bg-[hsl(142_25%_88%)] text-[hsl(142_25%_32%)]' },
  paid:             { label: 'Paid',            classes: 'bg-[hsl(142_25%_80%)] text-[hsl(142_25%_28%)] font-medium' },
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-secondary text-muted-foreground' }
  return (
    <span className={`inline-block font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 rounded ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
