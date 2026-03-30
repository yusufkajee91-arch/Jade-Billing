import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TimesheetView } from '@/components/time-recording/timesheet-view'

export default async function TimesheetPage() {
  const session = await getServerSession(authOptions)

  return <TimesheetView session={session!} />
}
