import { WEEKDAY_LABELS, isToday } from '../../utils/calendar'
import { eventDensityLevel } from '../../utils/calendarEvents'
import EventChip from './EventChip'

const MAX_CHIPS_PER_CELL = 3
const LEVEL_DOT = { 1: 'bg-accent/30', 2: 'bg-accent/50', 3: 'bg-accent/75', 4: 'bg-accent' }

// Day cells are clickable divs (not <button>) because each cell contains
// EventChip, which is itself a <button> — nesting <button> inside <button> is
// invalid HTML. Keyboard support (Enter/Space) keeps it as accessible as a
// real button; EventChip's own stopPropagation keeps chip clicks from also
// triggering the cell's day-select.
export default function MonthView({ weeks, eventsByDay, onSelectEvent, onSelectDay }) {
  const days = weeks.flat()
  const maxCount = Math.max(1, ...days.map((day) => (eventsByDay.get(day.date.toDateString()) || []).length))

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-surface-subtle">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(({ date, isCurrentMonth }) => {
            const dayEvents = eventsByDay.get(date.toDateString()) || []
            const visible = dayEvents.slice(0, MAX_CHIPS_PER_CELL)
            const overflow = dayEvents.length - visible.length
            const level = eventDensityLevel(dayEvents.length, maxCount)
            const today = isToday(date)

            return (
              <div
                key={date.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDay(date)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectDay(date)
                  }
                }}
                className={`focus-ring flex min-h-[104px] cursor-pointer flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors hover:bg-surface-subtle [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 ${isCurrentMonth ? '' : 'bg-surface-subtle/40'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${today ? 'bg-accent text-white' : isCurrentMonth ? 'text-copy' : 'text-faint'}`}>
                    {date.getDate()}
                  </span>
                  {level > 0 && <span className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[level]}`} title={`${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}`} />}
                </div>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {visible.map((event) => <EventChip key={event.id} event={event} onSelect={onSelectEvent} variant="chip" />)}
                  {overflow > 0 && <p className="px-1 text-[11px] font-semibold text-faint">+{overflow} more</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
