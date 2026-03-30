import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReportsView } from '@/components/reports/reports-view'

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const isAdmin = session.user.role === 'admin'
  return <ReportsView isAdmin={isAdmin} />
}
