import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ReconciliationView } from '@/components/bookkeeping/reconciliation-view'

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <ReconciliationView session={session} />
}
