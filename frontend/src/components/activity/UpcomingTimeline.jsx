import { CalendarClock, CheckCircle2, Clock, Code2, ListPlus, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState } from '../ui'
import { formatDayLabel, formatDurationHuman, formatMinutes, formatTime } from '../../utils/format'

const ITEM_CONFIG = {
  'task-overdue': { icon: TriangleAlert, tone: 'border-coral bg-coral-soft text-coral' },
  'task-due': { icon: Clock, tone: 'border-yellow bg-yellow-soft text-yellow' },
  'task-upcoming': { icon: CalendarClock, tone: 'border-line bg-surface-subtle text-muted' },
  // Matches the accent/green treatment ActivityRow and RecentActivityList
  // already use for coding activity elsewhere in the app.
  'task-completed': { icon: CheckCircle2, tone: 'border-accent bg-accent-soft text-accent' },
  'coding-activity': { icon: Code2, tone: 'border-accent bg-accent-soft text-accent' },
}

const isDueLooking = (type) => type === 'task-overdue' || type === 'task-due' || type === 'task-upcoming'

function TimelineRow({ item }) {
  const config = ITEM_CONFIG[item.type] || ITEM_CONFIG['task-upcoming']
  const Icon = config.icon
  const whenLabel = `${isDueLooking(item.type) ? 'Due ' : ''}${formatDayLabel(item.timestamp)} · ${formatTime(item.timestamp)}`
  // Prefer the precise seconds; fall back to the coarse minutes for older records.
  const durationLabel = formatDurationHuman(item.durationSeconds) || (item.durationMinutes ? formatMinutes(item.durationMinutes) : null)

  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <div className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${config.tone}`}><Icon size={13} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-copy">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-faint">
          {item.context}{durationLabel ? ` · ${durationLabel}` : ''} · {whenLabel}
        </p>
      </div>
    </div>
  )
}

function TimelineSection({ title, tone, items, footer }) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide ${tone || 'text-faint'}`}>{title}</p>
        {footer}
      </div>
      <Card className="divide-y divide-line overflow-hidden">
        {items.map((item) => <TimelineRow key={item.id} item={item} />)}
      </Card>
    </div>
  )
}

// Redesigned Timeline section for the Activity page — shows the user's
// journey (overdue, today, upcoming, recently completed) instead of a flat
// past-only feed. Each section is backed by useTimeline()'s classification.
export default function UpcomingTimeline({ sections }) {
  const navigate = useNavigate()
  const { overdue, today, upcoming, recent } = sections
  const hasAnything = overdue.length + today.length + upcoming.length + recent.length > 0

  if (!hasAnything) {
    return <Card><EmptyState compact icon={ListPlus} title="Nothing yet" description="Tasks and coding activity will appear here as you go." /></Card>
  }

  return (
    <div className="space-y-5">
      <TimelineSection title={`Overdue · ${overdue.length}`} tone="text-coral" items={overdue} />
      <TimelineSection title="Today" items={today} />
      <TimelineSection
        title="Upcoming"
        items={upcoming}
        footer={upcoming.length > 0 && (
          <button type="button" onClick={() => navigate('/tasks')} className="focus-ring text-xs font-semibold text-accent hover:underline">
            See all tasks →
          </button>
        )}
      />
      <TimelineSection title="Recently completed" items={recent} />
    </div>
  )
}
