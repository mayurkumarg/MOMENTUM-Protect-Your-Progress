import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Code2, ListPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeader, Section } from '../components/ui'
import { useTimeline } from '../hooks/useTimeline'
import { formatDateTime, formatMinutes } from '../utils/format'

const itemConfig = {
  'task-created': { icon: ListPlus, label: 'Task created', tone: 'border-yellow bg-yellow-soft text-yellow' },
  'task-completed': { icon: CheckCircle2, label: 'Task completed', tone: 'border-accent bg-accent-soft text-accent' },
  'coding-activity': { icon: Code2, label: 'Coding activity', tone: 'border-coral bg-coral-soft text-coral' },
}

function TimelineItem({ item }) {
  const config = itemConfig[item.type] || itemConfig['coding-activity']
  const Icon = config.icon

  return (
    <div className="flex min-w-0 gap-4 border-b border-line px-4 py-4 last:border-0 sm:px-5">
      <div className={`grid size-10 shrink-0 place-items-center rounded-md border ${config.tone}`}><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-sm font-semibold text-copy">{item.title}</p>
          <p className="text-xs text-faint">{formatDateTime(item.timestamp)}</p>
        </div>
        <p className="mt-1 text-xs text-muted">{config.label} · {item.context}{item.durationMinutes ? ` · ${formatMinutes(item.durationMinutes)}` : ''}</p>
      </div>
    </div>
  )
}

export default function Timeline() {
  const navigate = useNavigate()
  const { items, isLoading, error, refetch } = useTimeline()
  const [weekOffset, setWeekOffset] = useState(0)
  
  const weekLabel = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  const handleScheduleWork = () => {
    navigate('/tasks')
  }

  const handlePreviousWeek = () => {
    setWeekOffset(weekOffset - 1)
  }

  const handleNextWeek = () => {
    setWeekOffset(weekOffset + 1)
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="See the week" title="Timeline" description="Understand how planned work and real effort fit across your time." actions={<Button icon={Plus} onClick={handleScheduleWork}>Schedule work</Button>} />
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-semibold">{weekLabel}</p><p className="text-xs text-faint">Chronological feed from backend data</p></div>
        <div className="flex gap-1"><IconButton icon={ChevronLeft} label="Previous week" onClick={handlePreviousWeek} /><IconButton icon={CalendarDays} label="Choose week" /><IconButton icon={ChevronRight} label="Next week" onClick={handleNextWeek} /></div>
      </div>
      <Section title="Unified timeline" description="Tasks and captured coding activity, sorted by time.">
        {isLoading ? (
          <Card><LoadingState label="Building timeline" /></Card>
        ) : error ? (
          <Card><ErrorState title="Timeline could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch(() => {})}>Retry</Button>} /></Card>
        ) : items.length ? (
          <Card className="overflow-hidden">{items.map((item) => <TimelineItem key={item.id} item={item} />)}</Card>
        ) : (
          <Card><EmptyState compact title="Your timeline is open" description="Create tasks or capture coding activity and Momentum will place them here in order." /></Card>
        )}
      </Section>
    </div>
  )
}
