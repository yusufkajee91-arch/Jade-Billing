import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { NewClientPage } from './new-client-page'

export const metadata: Metadata = {
  title: 'New Client - Dolata & Co Billing',
}

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    redirect('/dashboard')
  }

  return <NewClientPage />
}
