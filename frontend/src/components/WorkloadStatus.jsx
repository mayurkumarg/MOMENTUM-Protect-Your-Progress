import { Gauge } from 'lucide-react'
import { Badge, Card, LoadingState } from './ui'

const TONE_BY_VALUE = {
  Low: 'green',
  Relaxed: 'green',
  'On Track': 'green',
  Light: 'green',
  Balanced: 'green',
  Moderate: 'yellow',
  Tight: 'yellow',
  Building: 'yellow',
  Stretched: 'yellow',
  High: 'coral',
  Critical: 'coral',
  'Needs Attention': 'coral',
  Overloaded: 'coral',
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 last:border-0">
      <span className="text-sm font-medium text-muted">{label}</span>
      <Badge tone={TONE_BY_VALUE[value] || 'neutral'}>{value}</Badge>
    </div>
  )
}

// Quiet by design: a secondary widget shouldn't surface a scary error state, it just doesn't render.
export function WorkloadStatusCard({ summary, isLoading, error }) {
  if (isLoading) {
    return <Card><LoadingState label="Reading your workload" /></Card>
  }

  if (error || !summary) {
    return null
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-accent-soft px-5 py-4">
        <div className="mb-2 grid size-9 place-items-center rounded-md bg-surface text-accent"><Gauge size={17} /></div>
        <p className="font-display text-lg font-bold text-ink">Workload status</p>
        <p className="mt-1 text-sm leading-5 text-muted">Combining your planned tasks and recent activity.</p>
      </div>
      <div>
        <StatusRow label="Workload level" value={summary.workloadLevel} />
        <StatusRow label="Schedule" value={summary.scheduleTightness} />
        <StatusRow label="Consistency" value={summary.taskConsistency} />
        <StatusRow label="Overall" value={summary.overloadStatus} />
      </div>
    </Card>
  )
}

function MetricStat({ value, label }) {
  return (
    <Card className="p-5">
      <span className="font-display text-3xl font-extrabold text-ink">{value}</span>
      <p className="mt-2 text-sm leading-5 text-muted">{label}</p>
    </Card>
  )
}

export function WorkloadMetricsGrid({ summary, isLoading, error }) {
  if (isLoading) {
    return <Card><LoadingState label="Reading your workload" /></Card>
  }

  if (error || !summary) {
    return null
  }

  const { metrics } = summary

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricStat value={metrics.currentStreakDays} label="day activity streak" />
      <MetricStat value={metrics.activeDaysLast7} label="active days this week" />
      <MetricStat value={metrics.completedTasksLast7} label="tasks completed this week" />
      <MetricStat value={metrics.overdueTasksCount} label="overdue tasks" />
    </div>
  )
}
