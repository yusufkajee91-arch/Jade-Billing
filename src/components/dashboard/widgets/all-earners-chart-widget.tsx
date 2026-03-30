import { AllEarnersChart } from '@/components/dashboard/all-earners-chart'

export function AllEarnersChartWidget() {
  return (
    <div className="glass-card glass-card-no-hover" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      <AllEarnersChart />
    </div>
  )
}
