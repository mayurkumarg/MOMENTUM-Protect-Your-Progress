import { ArrowRight, CheckSquare2, Code2, GitBranch, Plus, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WorkList from '../components/WorkList'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section, SetupPrompt } from '../components/ui'
import { useActivities } from '../hooks/useActivities'
import { useTasks } from '../hooks/useTasks'
import { formatDateTime, formatMinutes } from '../utils/format'
import { mapTaskToWorkItem, splitTasks } from '../utils/tasks'

function ActivityPreview({ activities }) {
  if (!activities.length) {
    return <Card><EmptyState compact icon={GitBranch} title="No connected activity yet" description="Once a coding source is connected, this becomes a clear record of real progress." /></Card>
  }

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {activities.slice(0, 5).map((activity) => (
        <div key={activity.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Code2 size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-copy">{activity.title}</p>
            <p className="mt-0.5 truncate text-xs text-faint">{activity.metadata?.platform || activity.source} · {formatDateTime(activity.activityDate)}</p>
          </div>
          <Badge tone="neutral">{formatMinutes(activity.durationMinutes)}</Badge>
        </div>
      ))}
    </Card>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const tasksQuery = useTasks()
  const activityQuery = useActivities()

  const groups = useMemo(() => splitTasks(tasksQuery.tasks), [tasksQuery.tasks])
  const focusNext = groups.today[0] || groups.upcoming[0] || null
  const todayTasks = groups.today.map(mapTaskToWorkItem)
  const upcomingTasks = groups.upcoming.slice(0, 4).map(mapTaskToWorkItem)
  const isLoading = tasksQuery.isLoading || activityQuery.isLoading
  const error = tasksQuery.error || activityQuery.error
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={dateLabel} title="Good afternoon." description="A calm view of what deserves your attention next." actions={<Button icon={Plus} onClick={() => navigate('/tasks')}>Add task</Button>} />
      {isLoading ? (
        <Card><LoadingState label="Loading your workspace" /></Card>
      ) : error ? (
        <Card><ErrorState title="Overview could not load" description={error.message} action={<Button variant="secondary" onClick={() => { tasksQuery.refetch().catch(() => {}); activityQuery.refetch().catch(() => {}) }}>Retry</Button>} /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <Section title="Today Snapshot" description="Only what is already in your task and activity records." action={<Button variant="ghost" onClick={() => navigate('/tasks')}>Open tasks <ArrowRight size={15} /></Button>}>
              {todayTasks.length ? <WorkList items={todayTasks} /> : <Card><EmptyState compact icon={CheckSquare2} title="No tasks due today" description="Today is clear unless you add something new." /></Card>}
            </Section>
            <SetupPrompt title="Bring your coding work into focus" description="Connect GitHub and the Momentum extension to let completed coding sessions quietly appear alongside planned work." />
            <Section title="Recent Activity" description="The latest work captured by the backend.">
              <ActivityPreview activities={activityQuery.activities} />
            </Section>
            <Section title="Upcoming Tasks" description="Pending tasks after today.">
              {upcomingTasks.length ? <WorkList items={upcomingTasks} /> : <Card><EmptyState compact icon={CheckSquare2} title="No upcoming tasks" description="Future work will appear here after you add deadlines." /></Card>}
            </Section>
          </div>
          <aside className="space-y-5">
            <Card className="p-5">
              <p className="eyebrow">Today</p>
              <div className="mt-5 flex items-end gap-3">
                <span className="font-display text-5xl font-extrabold text-ink">{groups.today.length}</span>
                <span className="pb-1 text-sm leading-5 text-muted">pending tasks<br />due today</span>
              </div>
              <p className="mt-4 text-xs leading-5 text-faint">{activityQuery.activities.length} activity records are available from the backend.</p>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-line bg-accent-soft p-5">
                <div className="mb-6 grid size-9 place-items-center rounded-md bg-surface text-accent"><Sparkles size={17} /></div>
                <p className="font-display text-lg font-bold text-ink">Focus Next</p>
                {focusNext ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-copy">{focusNext.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted">{focusNext.category || 'Task'} · due {formatDateTime(focusNext.deadline)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-5 text-muted">No pending task is available yet.</p>
                )}
              </div>
              <div className="p-3"><Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/tasks')}>Open tasks <ArrowRight size={15} /></Button></div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <div className="grid size-9 place-items-center rounded-md bg-coral-soft text-coral"><CheckSquare2 size={17} /></div>
              <div><p className="text-sm font-semibold">Completed tasks</p><p className="text-xs text-faint">{groups.completed.length} recorded in task history</p></div>
              <Badge tone="neutral">Now</Badge>
            </Card>
          </aside>
        </div>
      )}
    </div>
  )
}
