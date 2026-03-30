export const ENTITY_TYPE_LABELS: Record<string, string> = {
  individual_sa: 'Individual (SA)',
  company_pty: 'Company (Pty) Ltd',
  company_ltd: 'Company Ltd',
  close_corporation: 'Close Corporation (CC)',
  trust: 'Trust',
  partnership: 'Partnership',
  foreign_company: 'Foreign Company',
  other: 'Other',
}

export function formatEntityType(type: string): string {
  return ENTITY_TYPE_LABELS[type] ?? type
}
