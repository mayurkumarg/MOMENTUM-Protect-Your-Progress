import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, Clock, Code2, Flame, Github, ListChecks, TriangleAlert } from 'lucide-react'
import { Badge, Card } from './ui'
import { formatActivityDuration } from '../utils/format'

export function StatTile({ label, value, delta, deltaLabel }) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const isPositive = hasDelta && delta > 0
  const isNegative = hasDelta && delta < 0

  return (
    <Card className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold text-ink">{value}</span>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? 'text-accent' : isNegative ? 'text-coral' : 'text-faint'}`}>
            {isPositive && <ArrowUp size={12} />}
            {isNegative && <ArrowDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {deltaLabel && <p className="mt-1.5 text-xs leading-4 text-faint">{deltaLabel}</p>}
    </Card>
  )
}

function HeroStat({ icon: Icon, tone, value, label, sublabel }) {
  const toneClasses = {
    coral: 'bg-coral-soft text-coral',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-surface-subtle text-muted',
  }
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:p-4">
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
    <Card className="overflow-hidden">
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
  if (!heatmap || heatmap.length === 0) return null

  const weeks = []
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7))
  }

  const maxCount = Math.max(1, ...heatmap.map((day) => day.count))
  const activeDays = heatmap.filter((day) => day.count > 0).length
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <Card className="p-5 sm:p-6">
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
                    className={`size-[15px] rounded-[4px] transition-transform duration-150 hover:scale-125 ${LEVEL_CLASSES[levelForCount(day.count, maxCount)]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        <span>Less</span>
        {LEVEL_CLASSES.map((cls, index) => <div key={index} className={`size-[11px] rounded-[3px] ${cls}`} />)}
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

  return (
    <Card className="p-5">
      {total === 0 ? (
        <p className="text-sm text-muted">No problems solved yet today.</p>
      ) : (
        <>
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
        </>
      )}
    </Card>
  )
}

export function PlatformBreakdownBars({ platformBreakdown }) {
  if (!platformBreakdown || platformBreakdown.length === 0) return null

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

export function TaskCompletionPanel({ taskCompletion }) {
  if (!taskCompletion) return null

  const { completed, pending, overdue, total } = taskCompletion
  const pct = (value) => (total === 0 ? 0 : Math.max(value > 0 ? 3 : 0, (value / total) * 100))

  const rows = [
    { key: 'completed', label: 'Completed', value: completed, icon: CheckCircle2, dot: 'bg-accent', text: 'text-accent' },
    { key: 'pending', label: 'Pending', value: pending, icon: CircleDashed, dot: 'bg-faint', text: 'text-muted' },
    { key: 'overdue', label: 'Overdue', value: overdue, icon: TriangleAlert, dot: 'bg-coral', text: 'text-coral' },
  ]

  return (
    <Card className="p-5">
      {total === 0 ? (
        <p className="text-sm text-muted">No tasks yet — add one to see your completion breakdown here.</p>
      ) : (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-subtle">
            <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct(completed)}%` }} />
            <div className="h-full bg-faint/40 transition-[width] duration-500 ease-out" style={{ width: `${pct(pending)}%` }} />
            <div className="h-full bg-coral transition-[width] duration-500 ease-out" style={{ width: `${pct(overdue)}%` }} />
          </div>
          <div className="mt-4 space-y-2.5">
            {rows.map(({ key, label, value, icon: Icon, dot, text }) => (
              <div key={key} className="flex items-center gap-2.5 text-sm">
                <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                <Icon size={14} className={text} />
                <span className="flex-1 text-copy">{label}</span>
                <span className="font-semibold text-ink">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

export function RecentActivityList({ recent }) {
  if (!recent || recent.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">Nothing solved yet today — your recent solves will show up here.</p>
      </Card>
    )
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

// Static placeholder — no GitHub activity data exists on the backend yet. Kept in the
// same grid slot the real card will occupy later so wiring it up won't need a re-layout.
export function GitHubComingSoonCard() {
  return (
    <Card className="flex h-full flex-col items-start gap-3 border-dashed p-5">
      <div className="grid size-9 place-items-center rounded-md bg-surface-subtle text-muted"><Github size={17} /></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-[15px] font-bold text-ink">GitHub activity</p>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <p className="mt-1.5 text-sm leading-5 text-muted">Commits and meaningful repository activity will show up here once connected.</p>
      </div>
    </Card>
  )
}

