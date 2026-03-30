export const TEST_CLIENT = {
  clientName: 'Acme Holdings (Pty) Ltd',
  clientCode: 'ACM',
  entityType: 'company_pty',
  emailGeneral: 'info@acme.co.za',
}

export const TEST_CLIENT_2 = {
  clientName: 'Baker & Associates Trust',
  clientCode: 'BAK',
  entityType: 'trust',
  emailGeneral: 'admin@baker.co.za',
}

export const TEST_MATTER = {
  description: 'Trade mark registration — ACME Logo',
}

export const TEST_MATTER_2 = {
  description: 'Litigation — contractual dispute',
}

export const TEST_FEE_ENTRY = {
  narration: 'Client consultation regarding trade mark strategy',
  billedMinutes: 60,
  rateCents: 200000,
}

export const TEST_TRUST_RECEIPT = {
  entryType: 'trust_receipt',
  amountCents: 5000000,
  narration: 'Trust deposit — retainer',
}

export const TEST_DIARY_ENTRY = {
  title: 'File trade mark application',
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function formatCurrency(cents: number) {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function uniqueCode(prefix: string) {
  return `${prefix.slice(0, 3).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}
