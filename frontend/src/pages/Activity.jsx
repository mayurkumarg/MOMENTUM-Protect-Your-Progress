import { Chrome, CheckCircle2, Code2, Github, ListPlus, LoaderCircle, Plus, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useToast } from '../components/ToastProvider'
import { StatTile } from '../components/AnalyticsCharts'
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Input, LoadingState, PageHeader, Section } from '../components/ui'
import { useActivities } from '../hooks/useActivities'
import { useDsaSummary } from '../hooks/useDsaSummary'
import { useExtension } from '../hooks/useExtension'
import { useGithubIntegration } from '../hooks/useGithubIntegration'
import { useTimeline } from '../hooks/useTimeline'
import { formatActivityDuration, formatDateTime, formatDayLabel, formatDurationHuman, formatMinutes, formatTime, toDateTimeInputValue } from '../utils/format'

const DIFFICULTY_TONE = { Easy: 'green', Medium: 'yellow', Hard: 'coral' }

const TIMELINE_ITEM_CONFIG = {
  'task-created': { icon: ListPlus, label: 'Task created', tone: 'border-yellow bg-yellow-soft text-yellow' },
  'task-completed': { icon: CheckCircle2, label: 'Task completed', tone: 'border-accent bg-accent-soft text-accent' },
  'coding-activity': { icon: Code2, label: 'Coding activity', tone: 'border-coral bg-coral-soft text-coral' },
}

// Replaces the old standalone Timeline page: a compact, read-only view of the
// same tasks+activity story, capped to recent items instead of a paginated
// week-by-week feed — a quick "what happened recently" glance rather than a
// second management surface (the Activity feed section below already owns
// that, with delete).
function UnifiedTimeline({ items, limit = 10 }) {
  const recent = items.slice(0, limit)

  if (!recent.length) {
    return <Card><EmptyState compact icon={ListPlus} title="Nothing yet" description="Tasks and coding activity will appear here as you go." /></Card>
  }

  const groups = []
  let currentDay = null
  for (const item of recent) {
    const dayKey = new Date(item.timestamp).toDateString()
    if (dayKey !== currentDay) {
      groups.push({ dayKey, label: formatDayLabel(item.timestamp), entries: [] })
      currentDay = dayKey
    }
    groups[groups.length - 1].entries.push(item)
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.dayKey}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">{group.label}</p>
            <div className="space-y-4 border-l-2 border-line pl-4">
              {group.entries.map((item) => {
                const config = TIMELINE_ITEM_CONFIG[item.type] || TIMELINE_ITEM_CONFIG['coding-activity']
                const Icon = config.icon
                return (
                  <div key={item.id} className="relative flex items-start gap-3">
                    <div className={`absolute -left-[26px] top-0.5 grid size-6 place-items-center rounded-full border ${config.tone}`}><Icon size={12} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-copy">{item.title}</p>
                        <span className="shrink-0 text-xs text-faint">{formatTime(item.timestamp)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{config.label} · {item.context}{item.durationMinutes ? ` · ${formatMinutes(item.durationMinutes)}` : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const getSources = (extension, github) => [
  {
    icon: Github,
    title: 'GitHub',
    detail: github.status.repository ? `Syncing to ${github.status.repository.fullName}` : 'Commits and meaningful repository activity',
    status: github.status.repository ? 'Connected' : github.status.connected ? 'Repository needed' : 'Not connected',
    action: github.status.repository ? 'view-github' : 'connect-github',
    connected: Boolean(github.status.repository),
  },
  {
    icon: Chrome,
    title: 'Browser extension',
    detail: 'Practice activity from supported coding platforms',
    status: extension.isConnected ? 'Connected' : extension.isInstalled ? 'Installed' : 'Not installed',
    action: extension.isConnected ? null : 'install-extension',
    connected: extension.isConnected,
  },
]

const ACTIVITY_TYPES = [
  { value: 'CODING', label: 'Coding' },
  { value: 'STUDY', label: 'Study' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'REVISION', label: 'Revision' },
  { value: 'OTHER', label: 'Other' },
]

const emptyActivity = {
  title: '',
  activityType: 'CODING',
  durationMinutes: 30,
  category: '',
  activityDate: toDateTimeInputValue(new Date()),
}

function LogActivityModal({ open, onClose, onSubmit, isSaving }) {
  const [form, setForm] = useState(emptyActivity)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    const success = await onSubmit({
      title: form.title.trim(),
      activityType: form.activityType,
      durationMinutes: Number(form.durationMinutes),
      category: form.category.trim() || null,
      activityDate: new Date(form.activityDate).toISOString(),
    })
    if (success) setForm(emptyActivity)
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="log-activity-title">
      <h2 id="log-activity-title" className="font-display text-[15px] font-bold text-ink">Log activity</h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <Input label="What did you work on?" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Reviewed dynamic programming notes" required minLength={3} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-copy">Type</span>
          <select value={form.activityType} onChange={(event) => updateField('activityType', event.target.value)} className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy">
            {ACTIVITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Minutes spent" value={form.durationMinutes} onChange={(event) => updateField('durationMinutes', event.target.value)} type="number" min="1" max="1440" required />
          <Input label="Category (optional)" value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="DSA practice" />
        </div>
        <Input label="When" value={form.activityDate} onChange={(event) => updateField('activityDate', event.target.value)} type="datetime-local" max={toDateTimeInputValue(new Date())} required />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || form.title.trim().length < 3}>
            {isSaving && <LoaderCircle className="animate-spin" size={16} />}
            Save activity
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ActivityRow({ activity, onDelete, isPending }) {
  const platform = activity.metadata?.platform || activity.source || 'Manual'
  const url = activity.metadata?.url
  const duration = formatActivityDuration(activity)

  return (
    <div className="group flex min-w-0 gap-4 border-b border-line px-4 py-4 last:border-0 sm:px-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Code2 size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-sm font-semibold text-copy">{activity.title}</p>
          <Badge tone="green">{platform}</Badge>
        </div>
        <p className="mt-1 text-xs text-faint">{formatDateTime(activity.activityDate)} · {duration.label}{duration.isEstimated ? ' (est.)' : ''}</p>
        {url && <a className="mt-2 block truncate text-xs font-semibold text-accent hover:underline" href={url} target="_blank" rel="noreferrer">{url}</a>}
      </div>
      {onDelete && (
        <IconButton
          icon={Trash2}
          label={`Delete ${activity.title}`}
          className="hidden size-8 shrink-0 self-center opacity-0 group-hover:opacity-100 sm:grid disabled:pointer-events-none disabled:opacity-60"
          onClick={() => onDelete(activity)}
          disabled={isPending}
        />
      )}
    </div>
  )
}

function RecentSolveRow({ solve }) {
  const duration = formatActivityDuration(solve)
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-copy">{solve.title}</p>
        <p className="mt-0.5 text-xs text-faint">{solve.platform}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-muted">{duration.label}{duration.isEstimated ? ' (est.)' : ''}</span>
    </div>
  )
}

function CodingSummarySection({ summary, isLoading, error, onRetry }) {
  if (isLoading) {
    return <Card><LoadingState label="Reading today's activity" /></Card>
  }

  if (error) {
    return <Card><ErrorState title="Coding summary could not load" description={error.message} action={<Button variant="secondary" onClick={onRetry}>Retry</Button>} /></Card>
  }

  if (!summary || summary.problemsSolvedToday === 0) {
    return <Card><EmptyState compact icon={Zap} title="No problems solved yet today" description="Solve something on a connected platform and it'll show up here." /></Card>
  }

  const { problemsSolvedToday, totalMinutesToday, avgSolveSeconds, fastestSolve, slowestSolve, difficultyCounts, platformCounts, recent } = summary
  const platformEntries = Object.entries(platformCounts).filter(([, count]) => count > 0)
  const difficultyEntries = Object.entries(difficultyCounts).filter(([, count]) => count > 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Solved today" value={problemsSolvedToday} />
        <StatTile label="Time today" value={formatDurationHuman(totalMinutesToday * 60) || '0m'} />
        <StatTile label="Avg solve" value={formatDurationHuman(avgSolveSeconds) || '—'} />
        <StatTile label="Fastest solve" value={fastestSolve ? formatActivityDuration(fastestSolve).label : '—'} deltaLabel={fastestSolve?.title} />
        <StatTile label="Slowest solve" value={slowestSolve ? formatActivityDuration(slowestSolve).label : '—'} deltaLabel={slowestSolve?.title} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {difficultyEntries.map(([difficulty, count]) => (
          <Badge key={difficulty} tone={DIFFICULTY_TONE[difficulty] || 'neutral'}>{difficulty}: {count}</Badge>
        ))}
        {platformEntries.map(([platform, count]) => (
          <Badge key={platform} tone="neutral">{platform}: {count}</Badge>
        ))}
      </div>
      <Card className="overflow-hidden">
        {recent.map((solve, index) => <RecentSolveRow key={`${solve.title}-${index}`} solve={solve} />)}
      </Card>
    </div>
  )
}

export default function Activity() {
  const navigate = useNavigate()
  const toast = useToast()
  const { activities, isLoading, error, refetch, addActivity, removeActivity } = useActivities()
  const dsaSummaryQuery = useDsaSummary()
  const extension = useExtension()
  const github = useGithubIntegration()
  const timeline = useTimeline()
  const [showLogModal, setShowLogModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const sources = getSources(extension, github)

  const handleLogActivity = async (activity) => {
    setIsSaving(true)
    try {
      await addActivity(activity)
      setShowLogModal(false)
      toast.success('Activity logged.')
      return true
    } catch (submitError) {
      toast.error(submitError.message || 'Could not log activity.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setPendingId(pendingDelete.id)
    try {
      await removeActivity(pendingDelete.id)
      toast.success('Activity deleted.')
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete activity.')
    } finally {
      setPendingId(null)
      setPendingDelete(null)
    }
  }

  const handleConnectSource = (action) => {
    if (!action) return
    if (action === 'view-github') {
      navigate('/github')
    } else if (action === 'connect-github') {
      navigate('/settings')
    } else if (action === 'install-extension') {
      navigate(extension.isInstalled ? '/settings' : '/install')
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Observe" title="Activity" description="A trustworthy record of the work you actually did, captured with minimal effort." actions={<Button variant="secondary" icon={Plus} onClick={() => setShowLogModal(true)}>Log activity</Button>} />
      <Section title="Coding summary" description="Today's DSA practice, at a glance.">
        <CodingSummarySection
          summary={dsaSummaryQuery.summary}
          isLoading={dsaSummaryQuery.isLoading}
          error={dsaSummaryQuery.error}
          onRetry={() => dsaSummaryQuery.refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}
        />
      </Section>
      <Section title="Timeline" description="Tasks and coding activity, most recent first.">
        {timeline.isLoading ? (
          <Card><LoadingState label="Building your timeline" /></Card>
        ) : timeline.error ? (
          <Card><ErrorState title="Timeline could not load" description={timeline.error.message} action={<Button variant="secondary" onClick={() => timeline.refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>} /></Card>
        ) : (
          <UnifiedTimeline items={timeline.items} />
        )}
      </Section>
      <Section title="Connected sources" description="Choose which signals Momentum can use to understand your progress.">
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map(({ icon: Icon, title, detail, status, action, connected }) => <Card key={title} className="flex items-start gap-4 p-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={19} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-display text-[15px] font-bold">{title}</p><Badge tone={connected ? "green" : undefined}>{status}</Badge></div><p className="mt-1.5 text-sm leading-5 text-muted">{detail}</p>{action && <Button variant="ghost" className="mt-3 h-8 px-0 text-accent" onClick={() => handleConnectSource(action)}>{action === 'view-github' ? 'View GitHub activity' : 'Connect source'}</Button>}</div></Card>)}
        </div>
      </Section>
      <Section title="Activity feed" description="Coding sessions, commits, and practice submissions form a single history.">
        {isLoading ? (
          <Card><LoadingState label="Loading activity" /></Card>
        ) : error ? (
          <Card><ErrorState title="Activity could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>} /></Card>
        ) : activities.length ? (
          <Card className="overflow-hidden">{activities.map((activity) => <ActivityRow key={activity.id} activity={activity} onDelete={setPendingDelete} isPending={pendingId === activity.id} />)}</Card>
        ) : (
          <Card><EmptyState icon={Code2} title="Your work record starts here" description="Connect a source or log an activity to begin building a useful history of your effort." action={<Button variant="secondary" onClick={() => handleConnectSource('connect-github')}>Choose a source</Button>} /></Card>
        )}
      </Section>
      <LogActivityModal open={showLogModal} onClose={() => setShowLogModal(false)} onSubmit={handleLogActivity} isSaving={isSaving} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.title || ''}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        isLoading={pendingId === pendingDelete?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
