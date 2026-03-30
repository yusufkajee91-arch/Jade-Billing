import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MatterDetail } from '@/components/matters/matter-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MatterDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: true,
      owner: {
        select: { id: true, firstName: true, lastName: true, initials: true, role: true },
      },
      matterType: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      matterUsers: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, initials: true, role: true },
          },
        },
      },
      attachments: {
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      },
      matterNotes: {
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      diaryEntries: {
        orderBy: { dueDate: 'asc' },
      },
    },
  })

  if (!matter) {
    redirect('/matters')
  }

  // Access check
  const isAdmin = session.user.role === 'admin'
  const isOwner = matter.ownerId === session.user.id
  const hasAccess = matter.matterUsers.some((mu) => mu.userId === session.user.id)

  if (!isAdmin && !isOwner && !hasAccess) {
    redirect('/matters')
  }

  // Serialize for client component
  const serialised = JSON.parse(JSON.stringify(matter))

  return <MatterDetail matter={serialised} session={session} />
}
