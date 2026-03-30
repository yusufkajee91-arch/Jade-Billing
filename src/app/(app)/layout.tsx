import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'

export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <AppLayout session={session}>{children}</AppLayout>
}
