import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiaryView } from '@/components/diary/diary-view'

export default async function DiaryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const isAdmin = session.user.role === 'admin'
  const userId = session.user.id
  return <DiaryView isAdmin={isAdmin} currentUserId={userId} />
}
