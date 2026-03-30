import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { BusinessAccountView } from '@/components/bookkeeping/business-account-view'

export default async function BusinessAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <BusinessAccountView session={session} />
}
