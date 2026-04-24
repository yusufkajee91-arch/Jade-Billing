import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { TrustAccountView } from '@/components/bookkeeping/trust-account-view'

export default async function TrustAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  return <TrustAccountView session={session} />
}
