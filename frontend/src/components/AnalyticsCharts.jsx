import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react'
import { Card } from './ui'

export function StatTile({ label, value, delta, deltaLabel }) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const isPositive = hasDelta && delta > 0
  const isNegative = hasDelta && delta < 0

  return (
    <Card className="p-5">
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
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <Card className="overflow-x-auto p-5">
      <div className="flex w-max gap-3">
        <div className="flex flex-col justify-between py-px text-[10px] text-faint">
          {dayLabels.map((label, index) => (
            <span key={index} className="h-[13px] leading-[13px]">{label}</span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} ${day.count === 1 ? 'activity' : 'activities'}`}
                  className={`size-[13px] rounded-[3px] ${LEVEL_CLASSES[levelForCount(day.count, maxCount)]}`}
                />
              ))}
            </div>
          ))}
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
                className="h-full rounded-full bg-accent transition-[width]"
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
            <div className="h-full bg-accent" style={{ width: `${pct(completed)}%` }} />
            <div className="h-full bg-faint/40" style={{ width: `${pct(pending)}%` }} />
            <div className="h-full bg-coral" style={{ width: `${pct(overdue)}%` }} />
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
