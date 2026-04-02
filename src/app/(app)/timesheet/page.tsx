import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TimesheetView } from '@/components/time-recording/timesheet-view'
import { pageLogger } from '@/lib/debug'

const log = pageLogger('timesheet')

export default async function TimesheetPage() {
  log.info('Rendering timesheet page')
  const session = await getServerSession(authOptions)
  log.debug('Session for timesheet:', {
    userId: session?.user?.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: (session?.user as any)?.role,
    name: session?.user?.name,
  })
  if (!session) {
    log.error('No session found for timesheet page!')
  }
  return <TimesheetView session={session!} />
}
