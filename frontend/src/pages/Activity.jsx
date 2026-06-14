import { Chrome, Code2, Github, Plus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section } from '../components/ui'
import { useActivities } from '../hooks/useActivities'
import { formatDateTime, formatMinutes } from '../utils/format'

const sources = [
  { icon: Github, title: 'GitHub', detail: 'Commits and meaningful repository activity', status: 'Backend ready' },
  { icon: Chrome, title: 'Browser extension', detail: 'Practice activity from supported coding platforms', status: 'DSA ready' },
]

function ActivityRow({ activity }) {
  const platform = activity.metadata?.platform || activity.source || 'Manual'
  const url = activity.metadata?.url

  return (
    <div className="flex min-w-0 gap-4 border-b border-line px-4 py-4 last:border-0 sm:px-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Code2 size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-sm font-semibold text-copy">{activity.title}</p>
          <Badge tone="green">{platform}</Badge>
        </div>
        <p className="mt-1 text-xs text-faint">{formatDateTime(activity.activityDate)} · {formatMinutes(activity.durationMinutes)}</p>
        {url && <a className="mt-2 block truncate text-xs font-semibold text-accent hover:underline" href={url} target="_blank" rel="noreferrer">{url}</a>}
      </div>
    </div>
  )
}

export default function Activity() {
  const { activities, isLoading, error, refetch } = useActivities()

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Observe" title="Activity" description="A trustworthy record of the work you actually did, captured with minimal effort." actions={<Button variant="secondary" icon={Plus}>Log activity</Button>} />
      <Section title="Connected sources" description="Choose which signals Momentum can use to understand your progress.">
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map(({ icon: Icon, title, detail, status }) => <Card key={title} className="flex items-start gap-4 p-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={19} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-display text-[15px] font-bold">{title}</p><Badge>{status}</Badge></div><p className="mt-1.5 text-sm leading-5 text-muted">{detail}</p><Button variant="ghost" className="mt-3 h-8 px-0 text-accent">Connect source</Button></div></Card>)}
        </div>
      </Section>
      <Section title="Activity feed" description="Coding sessions, commits, and practice submissions form a single history.">
        {isLoading ? (
          <Card><LoadingState label="Loading activity" /></Card>
        ) : error ? (
          <Card><ErrorState title="Activity could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch(() => {})}>Retry</Button>} /></Card>
        ) : activities.length ? (
          <Card className="overflow-hidden">{activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</Card>
        ) : (
          <Card><EmptyState icon={Code2} title="Your work record starts here" description="Connect a source or log an activity to begin building a useful history of your effort." action={<Button variant="secondary">Choose a source</Button>} /></Card>
        )}
      </Section>
    </div>
  )
}
