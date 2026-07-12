import { Gauge, TriangleAlert } from 'lucide-react'
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
  'Not Started': 'neutral',
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 last:border-0">
      <span className="text-sm font-medium text-muted">{label}</span>
      <Badge tone={TONE_BY_VALUE[value] || 'neutral'}>{value}</Badge>
    </div>
  )
}

export function WorkloadStatusCard({ summary, isLoading, error }) {
  if (isLoading) {
    return <Card><LoadingState label="Reading your workload" /></Card>
  }

  if (error || !summary) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted">
        <TriangleAlert size={16} className="shrink-0 text-faint" />
        Workload status is unavailable right now.
      </Card>
    )
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
