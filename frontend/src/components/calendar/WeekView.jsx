import { WEEKDAY_LABELS, isToday } from '../../utils/calendar'
import EventChip from './EventChip'

// 7 stacked-agenda columns, not an hour-by-hour grid — tasks/activities here
// are single-instant (a deadline, a logged solve), not scheduled time blocks,
// so a list per day is enough. An hourly grid is exactly the "Automatic Time
// Blocking" the user deferred to a future phase.
export default function WeekView({ days, eventsByDay, onSelectEvent }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-3">
        {days.map((date) => {
          const dayEvents = (eventsByDay.get(date.toDateString()) || []).slice().sort((a, b) => a.date - b.date)
          const today = isToday(date)

          return (
            <div key={date.toISOString()} className={`rounded-lg border p-2.5 ${today ? 'border-accent/40 bg-accent-soft/30' : 'border-line bg-surface'}`}>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{WEEKDAY_LABELS[(date.getDay() + 6) % 7]}</p>
                <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${today ? 'bg-accent text-white' : 'text-copy'}`}>{date.getDate()}</span>
              </div>
              <div className="space-y-1.5">
                {dayEvents.length > 0 ? (
                  dayEvents.map((event) => <EventChip key={event.id} event={event} onSelect={onSelectEvent} variant="row" />)
                ) : (
                  <p className="py-3 text-center text-[11px] text-faint">No events</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
