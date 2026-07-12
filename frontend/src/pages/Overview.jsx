import { Activity as ActivityIcon, ArrowRight, CheckSquare2, Code2, Download, GitBranch, MessageCircle, NotebookText, Plus, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import WorkList from '../components/WorkList'
import { TodayHeroCard } from '../components/AnalyticsCharts'
import { WorkloadStatusCard } from '../components/WorkloadStatus'
import { useToast } from '../components/ToastProvider'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section, Skeleton } from '../components/ui'
import { useActivities } from '../hooks/useActivities'
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary'
import { useDsaSummary } from '../hooks/useDsaSummary'
import { useExtension } from '../hooks/useExtension'
import { useTasks } from '../hooks/useTasks'
import { useWorkload } from '../hooks/useWorkload'
import { formatActivityDuration, formatDateTime, formatDurationHuman, getGreeting } from '../utils/format'
import { mapTaskToWorkItem, splitTasks } from '../utils/tasks'

const CONTINUE_LINKS = [
  { to: '/activity', label: 'Activity', description: 'Your latest tracked practice', icon: ActivityIcon },
  { to: '/journal', label: 'Coding Journal', description: 'Auto-synced solves on GitHub', icon: NotebookText },
  { to: '/assistant', label: 'Assistant', description: 'Ask about your progress', icon: MessageCircle },
]

function ActivityPreview({ activities }) {
  if (!activities.length) {
    return <Card><EmptyState compact icon={GitBranch} title="No connected activity yet" description="Once a coding source is connected, this becomes a clear record of real progress." /></Card>
  }

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {activities.slice(0, 5).map((activity) => {
        const duration = formatActivityDuration(activity)
        return (
          <div key={activity.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Code2 size={17} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-copy">{activity.title}</p>
              <p className="mt-0.5 truncate text-xs text-faint">{activity.metadata?.platform || activity.source} · {formatDateTime(activity.activityDate)}</p>
            </div>
            <Badge tone="neutral">{duration.label}{duration.isEstimated ? ' (est.)' : ''}</Badge>
          </div>
        )
      })}
    </Card>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const toast = useToast()
  const tasksQuery = useTasks()
  const activityQuery = useActivities()
  const workloadQuery = useWorkload()
  const analyticsQuery = useAnalyticsSummary()
  const dsaQuery = useDsaSummary()
  const extension = useExtension()

  const groups = useMemo(() => splitTasks(tasksQuery.tasks), [tasksQuery.tasks])
  const focusNext = groups.today[0] || groups.upcoming[0] || null
  const todayTasks = groups.today.map(mapTaskToWorkItem)
  const upcomingTasks = groups.upcoming.slice(0, 4).map(mapTaskToWorkItem)
  const isLoading = tasksQuery.isLoading || activityQuery.isLoading
  const error = tasksQuery.error || activityQuery.error
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const isFirstTimeUser = !activityQuery.isLoading && activityQuery.activities.length === 0
  // Only prompt to install when the extension genuinely isn't there. useExtension
  // is the single source of truth for extension status (Settings reads the same
  // hook), so once the content script announces itself the homepage stops asking.
  const shouldPromptInstall = isFirstTimeUser && !extension.isInstalled

  const tasksCompletedToday = useMemo(() => {
    const todayKey = new Date().toDateString()
    return tasksQuery.tasks.filter(
      (task) => task.status === 'COMPLETED' && task.completedAt && new Date(task.completedAt).toDateString() === todayKey
    ).length
  }, [tasksQuery.tasks])

  const handleRetry = () => {
    Promise.all([tasksQuery.refetch(), activityQuery.refetch()]).catch((retryError) => {
      toast.error(retryError.message || 'Still unable to load. Please try again.')
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={dateLabel} title={getGreeting()} description="A calm view of what deserves your attention next." actions={<Button icon={Plus} onClick={() => navigate('/tasks')}>Add task</Button>} />

      {shouldPromptInstall ? (
        <Card className="overflow-hidden border-accent/30 bg-accent-soft/40">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow mb-2">Get started</p>
              <p className="font-display text-lg font-bold text-ink">Momentum tracks your DSA practice automatically</p>
              <p className="mt-1.5 max-w-md text-sm leading-5 text-muted">Install the browser extension once, and every problem you solve on LeetCode, Codeforces, and more shows up here — no manual logging.</p>
            </div>
            <Button icon={Download} className="shrink-0" onClick={() => navigate('/install')}>Install extension</Button>
          </div>
        </Card>
      ) : analyticsQuery.isLoading || dsaQuery.isLoading ? (
        <Skeleton className="h-44 w-full" />
      ) : analyticsQuery.summary ? (
        <TodayHeroCard
          problemsSolvedToday={dsaQuery.summary?.problemsSolvedToday || 0}
          tasksCompletedToday={tasksCompletedToday}
          timeTodayLabel={formatDurationHuman((dsaQuery.summary?.totalMinutesToday || 0) * 60) || '0m'}
          streakCurrent={analyticsQuery.summary.streak.current}
          streakLongest={analyticsQuery.summary.streak.longest}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {CONTINUE_LINKS.map(({ to, label, description, icon: Icon }) => (
          <NavLink key={to} to={to} className="focus-ring block rounded-xl">
            <Card hover className="flex items-start gap-3 p-4">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Icon size={17} /></div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-copy">{label}</p>
                <p className="mt-0.5 text-xs text-faint">{description}</p>
              </div>
            </Card>
          </NavLink>
        ))}
      </div>

      {isLoading ? (
        <Card><LoadingState label="Loading your workspace" /></Card>
      ) : error ? (
        <Card><ErrorState title="Overview could not load" description={error.message} action={<Button variant="secondary" onClick={handleRetry}>Retry</Button>} /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <Section title="Today Snapshot" description="Only what is already in your task and activity records." action={<Button variant="ghost" onClick={() => navigate('/tasks')}>Open tasks <ArrowRight size={15} /></Button>}>
              {todayTasks.length ? <WorkList items={todayTasks} /> : <Card><EmptyState compact icon={CheckSquare2} title="No tasks due today" description="Today is clear unless you add something new." /></Card>}
            </Section>
            <WorkloadStatusCard summary={workloadQuery.summary} isLoading={workloadQuery.isLoading} error={workloadQuery.error} />
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
            </Card>
            <Card hover className="overflow-hidden">
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
            <Card className="flex items-center gap-3 p-5">
              <div className="grid size-9 place-items-center rounded-md bg-coral-soft text-coral"><CheckSquare2 size={17} /></div>
              <div><p className="text-sm font-semibold">Completed tasks</p><p className="text-xs text-faint">{groups.completed.length} recorded in task history</p></div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  )
}
