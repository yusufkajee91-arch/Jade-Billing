import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { DebtorsView } from '@/components/clients/debtors-view'

export default async function DebtorsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  return <DebtorsView />
}
