import { Activity, ArrowDown, ArrowUp, BarChart3, Briefcase, CheckCircle2, CircleDashed, Clock, Code2, Flame, Github, ListChecks, TrendingUp, TriangleAlert } from 'lucide-react'
import { Badge, Card, EmptyState } from './ui'
import { formatActivityDuration } from '../utils/format'

export function StatTile({ label, value, delta, deltaLabel }) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const isPositive = hasDelta && delta > 0
  const isNegative = hasDelta && delta < 0

  return (
    <Card hover className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[30px] font-extrabold leading-none text-ink">{value}</span>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${isPositive ? 'bg-accent-soft text-accent' : isNegative ? 'bg-coral-soft text-coral' : 'text-faint'}`}>
            {isPositive && <ArrowUp size={11} />}
            {isNegative && <ArrowDown size={11} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {deltaLabel && <p className="mt-2 text-xs leading-4 text-faint">{deltaLabel}</p>}
    </Card>
  )
}

export function HeroStat({ icon: Icon, tone, value, label, sublabel }) {
  const toneClasses = {
    coral: 'bg-coral-soft text-coral',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-surface-subtle text-muted',
  }
  return (
    <div className="lift min-w-0 rounded-lg border border-line bg-surface p-3.5 sm:p-4">
      <div className={`grid size-8 place-items-center rounded-md ${toneClasses[tone]}`}><Icon size={15} /></div>
      <p className="mt-2.5 truncate font-display text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-faint">{label}</p>
      {sublabel && <p className="truncate text-[11px] text-faint">{sublabel}</p>}
    </div>
  )
}

// The page's headline moment — answers "did I do something today?" before anything else.
export function TodayHeroCard({ problemsSolvedToday, tasksCompletedToday, timeTodayLabel, streakCurrent, streakLongest }) {
  const hasActivity = problemsSolvedToday > 0 || tasksCompletedToday > 0

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-transparent via-transparent to-accent-soft/40">
      <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Today</p>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-6xl font-extrabold leading-none text-ink sm:text-7xl">{problemsSolvedToday}</span>
            <span className="text-base font-semibold text-muted">{problemsSolvedToday === 1 ? 'problem solved' : 'problems solved'}</span>
          </div>
          <p className="mt-2.5 max-w-sm text-sm leading-5 text-muted">
            {hasActivity ? "You're building momentum — keep it going." : 'Nothing logged yet today — your first solve starts the count.'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <HeroStat icon={Flame} tone="coral" value={`${streakCurrent}d`} label="streak" sublabel={streakLongest > streakCurrent ? `best ${streakLongest}d` : undefined} />
          <HeroStat icon={ListChecks} tone="accent" value={tasksCompletedToday} label="tasks done" />
          <HeroStat icon={Clock} tone="muted" value={timeTodayLabel} label="time today" />
        </div>
      </div>
    </Card>
  )
}

// Chunks the flat 98-day series into 14 columns of 7 days — a trailing 98-day window,
// not calendar-aligned Mon-Sun weeks, so it always renders a clean 14x7 grid regardless
// of what day-of-week the window happens to start on.
const LEVEL_CLASSES = ['bg-surface-subtle', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent']

function levelForCount(count, maxCount) {
  if (count === 0) return 0
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function ActivityHeatmap({ heatmap }) {
  if (!heatmap || heatmap.length === 0) {
    return <Card><EmptyState compact icon={Activity} title="No activity yet" description="Solved problems will start filling in this heatmap." /></Card>
  }

  const weeks = []
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7))
  }

  const maxCount = Math.max(1, ...heatmap.map((day) => day.count))
  const activeDays = heatmap.filter((day) => day.count > 0).length
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-muted"><span className="font-semibold text-ink">{activeDays}</span> active {activeDays === 1 ? 'day' : 'days'} in the last 14 weeks</p>
      <div className="overflow-x-auto">
        <div className="flex w-max gap-3">
          <div className="flex flex-col justify-between py-px text-[10px] text-faint">
            {dayLabels.map((label, index) => (
              <span key={index} className="h-[15px] leading-[15px]">{label}</span>
            ))}
          </div>
          <div className="flex gap-[4px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[4px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} ${day.count === 1 ? 'activity' : 'activities'}`}
                    className={`size-[15px] rounded transition-transform duration-150 hover:scale-125 ${LEVEL_CLASSES[levelForCount(day.count, maxCount)]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        <span>Less</span>
        {LEVEL_CLASSES.map((cls, index) => <div key={index} className={`size-[11px] rounded-sm ${cls}`} />)}
        <span>More</span>
      </div>
    </Card>
  )
}

const DIFFICULTY_FILL = { Easy: 'bg-accent', Medium: 'bg-yellow', Hard: 'bg-coral' }
const DIFFICULTY_TEXT = { Easy: 'text-accent', Medium: 'text-yellow', Hard: 'text-coral' }

export function DifficultyBreakdown({ difficultyCounts }) {
  const entries = [
    ['Easy', difficultyCounts?.Easy || 0],
    ['Medium', difficultyCounts?.Medium || 0],
    ['Hard', difficultyCounts?.Hard || 0],
  ]
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  if (total === 0) {
    return <Card><EmptyState compact icon={BarChart3} title="No problems solved today" description="A difficulty breakdown will appear once you log a solve." /></Card>
  }

  return (
    <Card className="p-5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-subtle">
        {entries.map(([difficulty, count]) => count > 0 && (
          <div key={difficulty} className={`h-full ${DIFFICULTY_FILL[difficulty]}`} style={{ width: `${(count / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {entries.map(([difficulty, count]) => (
          <div key={difficulty} className="flex items-center gap-2.5 text-sm">
            <span className={`size-2 shrink-0 rounded-full ${DIFFICULTY_FILL[difficulty]}`} />
            <span className="flex-1 text-copy">{difficulty}</span>
            <span className={`font-semibold ${DIFFICULTY_TEXT[difficulty]}`}>{count}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function PlatformBreakdownBars({ platformBreakdown }) {
  if (!platformBreakdown || platformBreakdown.length === 0) {
    return <Card><EmptyState compact icon={Code2} title="No platform activity yet" description="Solved problems from a connected platform will show up here." /></Card>
  }

  const maxCount = Math.max(...platformBreakdown.map((entry) => entry.count))

  return (
    <Card className="p-5">
      <div className="space-y-3">
        {platformBreakdown.map((entry) => (
          <div key={entry.platform} className="group flex items-center gap-3 rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-surface-subtle">
            <span className="w-24 shrink-0 truncate text-sm font-medium text-copy">{entry.platform}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(4, (entry.count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">{entry.count}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Circular "at a glance" read on a percentage — used for task completion,
// generic enough to reuse anywhere a single ratio needs a headline visual.
export function ProgressRing({ value, size = 96, strokeWidth = 9, label, sublabel }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value || 0))
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-surface-subtle" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="min-w-0">
        <p className="font-display text-2xl font-extrabold text-ink">{clamped}%</p>
        {label && <p className="text-xs font-semibold text-copy">{label}</p>}
        {sublabel && <p className="mt-0.5 text-xs text-faint">{sublabel}</p>}
      </div>
    </div>
  )
}

export function TaskCompletionRing({ taskCompletion }) {
  if (!taskCompletion) return null
  const { completed, pending, overdue, total, completionRate } = taskCompletion

  if (total === 0) {
    return <Card><EmptyState compact icon={ListChecks} title="No tasks yet" description="Add a task to see your completion rate here." /></Card>
  }

  const stats = [
    { key: 'completed', label: 'Done', value: completed, icon: CheckCircle2, text: 'text-accent' },
    { key: 'pending', label: 'Pending', value: pending, icon: CircleDashed, text: 'text-muted' },
    { key: 'overdue', label: 'Overdue', value: overdue, icon: TriangleAlert, text: 'text-coral' },
  ]

  return (
    <Card className="p-5">
      <div className="flex items-center justify-center py-1">
        <ProgressRing value={completionRate} label="Completed" sublabel={`${completed} of ${total} tasks`} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
        {stats.map(({ key, label, value, icon: Icon, text }) => (
          <div key={key} className="flex flex-col items-center gap-1 text-center">
            <Icon size={14} className={text} />
            <p className="font-display text-base font-bold text-ink">{value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Aggregates the trailing 98-day heatmap window into weekly totals and shows
// the last 8 as bars — enough to see whether effort is trending up or down
// without a second full heatmap.
export function ProductivityTrend({ heatmap }) {
  if (!heatmap || heatmap.length === 0) {
    return <Card><EmptyState compact icon={TrendingUp} title="No trend yet" description="Weekly totals will appear here once you start logging activity." /></Card>
  }

  const weeks = []
  for (let i = 0; i < heatmap.length; i += 7) {
    const chunk = heatmap.slice(i, i + 7)
    const total = chunk.reduce((sum, day) => sum + day.count, 0)
    weeks.push({ weekStart: chunk[0].date, total })
  }

  const recentWeeks = weeks.slice(-8)
  const maxTotal = Math.max(1, ...recentWeeks.map((week) => week.total))

  return (
    <Card className="p-5">
      <div className="flex h-28 items-end gap-2.5">
        {recentWeeks.map((week, index) => {
          const isLast = index === recentWeeks.length - 1
          const heightPct = week.total === 0 ? 3 : Math.max(6, Math.round((week.total / maxTotal) * 100))
          return (
            <div key={week.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  title={`Week of ${week.weekStart}: ${week.total} ${week.total === 1 ? 'activity' : 'activities'}`}
                  className={`w-full rounded-t-md transition-all duration-500 ease-out ${isLast ? 'bg-accent' : 'bg-accent/30 hover:bg-accent/50'}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-faint">{isLast ? 'Now' : ''}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function RecentActivityList({ recent }) {
  if (!recent || recent.length === 0) {
    return <Card><EmptyState compact icon={Code2} title="Nothing solved today" description="Your recent solves will show up here." /></Card>
  }

  return (
    <Card className="overflow-hidden">
      {recent.map((solve, index) => {
        const duration = formatActivityDuration(solve)
        return (
          <div key={`${solve.title}-${index}`} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-subtle sm:px-5">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Code2 size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-copy">{solve.title}</p>
              <p className="mt-0.5 text-xs text-faint">{solve.platform}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-muted">{duration.label}{duration.isEstimated ? ' (est.)' : ''}</span>
          </div>
        )
      })}
    </Card>
  )
}

// Small teaser pointing at the full /journal (Coding Journal) dashboard.
// Connects inline (no detour through Settings) when not yet connected —
// `onConnect` is expected to be wired to useGithubConnect by the page
// rendering this, `onView` to a simple navigate('/journal'). Kept
// presentational otherwise, matching the rest of this file.
// Folds real sync numbers in when available (stats), so this reads as part
// of the same productivity picture instead of a bare "connected" badge — the
// full breakdown still lives on /journal, this is the at-a-glance summary.
export function GithubActivityTeaser({ connected, repositoryName, connecting, stats, onConnect, onView }) {
  return (
    <Card className="flex h-full flex-col items-start gap-3 p-5">
      <div className="flex w-full items-start justify-between gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Github size={17} /></div>
        <Badge tone={connected ? 'green' : 'neutral'}>{connected ? 'Connected' : 'Not connected'}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-ink">Coding journal</p>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          {connected ? `Syncing solved problems to ${repositoryName}.` : 'Connect GitHub to build an automatic coding journal from solved problems.'}
        </p>
      </div>
      {connected && stats && (
        <div className="grid w-full grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <p className="font-display text-lg font-bold text-ink">{stats.synced}</p>
            <p className="text-[11px] text-faint">Synced to date</p>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ink">{stats.currentStreak}d</p>
            <p className="text-[11px] text-faint">Sync streak</p>
          </div>
        </div>
      )}
      <button onClick={connected ? onView : onConnect} disabled={connecting} className="focus-ring text-xs font-semibold text-accent hover:underline disabled:opacity-60">
        {connected ? 'View coding journal' : connecting ? 'Redirecting to GitHub...' : 'Connect GitHub'} →
      </button>
    </Card>
  )
}

// Small teaser pointing at the full /placements Placement Tracker — same
// compact shape as GithubActivityTeaser above, so Analytics reads as one
// consistent set of "quick look, then go deeper" cards.
export function PlacementTeaser({ stats, onView }) {
  const hasCompanies = Boolean(stats && stats.total > 0)

  return (
    <Card className="flex h-full flex-col items-start gap-3 p-5">
      <div className="flex w-full items-start justify-between gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Briefcase size={17} /></div>
        {hasCompanies && <Badge tone="neutral">{stats.total} tracked</Badge>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-ink">Placements</p>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          {hasCompanies ? 'Companies, prep tasks, and interview notes in one tracker.' : 'Track companies, prep tasks, and interview notes in one place.'}
        </p>
      </div>
      {hasCompanies && (
        <div className="grid w-full grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <p className="font-display text-lg font-bold text-ink">{stats.applied}</p>
            <p className="text-[11px] text-faint">Active applications</p>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ink">{stats.upcomingInterviews + stats.upcomingOAs}</p>
            <p className="text-[11px] text-faint">Upcoming rounds</p>
          </div>
        </div>
      )}
      <button onClick={onView} className="focus-ring text-xs font-semibold text-accent hover:underline">
        {hasCompanies ? 'View Placement Tracker' : 'Start tracking placements'} →
      </button>
    </Card>
  )
}

