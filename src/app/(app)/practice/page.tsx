import { PracticeOverview } from '@/components/matters/practice-overview'
import { pageLogger } from '@/lib/debug'

const log = pageLogger('PracticePage')

export default function PracticePage() {
  log.info('rendering PracticePage')
  return <PracticeOverview />
}
