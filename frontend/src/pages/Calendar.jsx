import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DayView from '../components/calendar/DayView'
import EventDetailModal from '../components/calendar/EventDetailModal'
import MonthView from '../components/calendar/MonthView'
import WeekView from '../components/calendar/WeekView'
import { useToast } from '../components/ToastProvider'
import { Button, Card, ErrorState, IconButton, LoadingState, PageHeader, SegmentedControl } from '../components/ui'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useTasks } from '../hooks/useTasks'
import { formatPeriodLabel, getMonthGrid, getWeekDays, shiftDate } from '../utils/calendar'
import { splitTasks } from '../utils/tasks'

const VIEW_OPTIONS = ['Day', 'Week', 'Month']

export default function Calendar() {
  const navigate = useNavigate()
  const toast = useToast()
  const [view, setView] = useState('Month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { events, eventsByDay, isLoading, error, refetch, updateTask } = useCalendarEvents(view, currentDate)

  // Independent of the visible range — an overdue task from last month should
  // still be flagged while looking at this month. Reuses the same unfiltered
  // fetch + splitTasks() classification the Overview/Timeline already use.
  const allTasksQuery = useTasks()
  const overdueCount = useMemo(() => splitTasks(allTasksQuery.tasks).overdue.length, [allTasksQuery.tasks])

  const monthGrid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const periodLabel = useMemo(() => formatPeriodLabel(view, currentDate), [view, currentDate])

  const handleSelectDay = (date) => {
    setCurrentDate(date)
    setView('Day')
  }

  const handleUpdateTask = async (id, updates) => {
    const updated = await updateTask(id, updates)
    return updated
  }

  const handleRetry = () => {
    Promise.all([refetch(), allTasksQuery.refetch()]).catch((retryError) => {
      toast.error(retryError.message || 'Still unable to load. Please try again.')
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan visually"
        title="Calendar"
        description="Every task deadline and coding session, laid out over time — no duplicate entry, always in sync with the rest of Momentum."
        actions={
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/activity')}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-coral/30 bg-coral-soft px-3 py-1.5 text-xs font-semibold text-coral transition-colors hover:bg-coral/10"
              >
                <AlertTriangle size={13} /> {overdueCount} overdue
              </button>
            )}
            <Button icon={Plus} onClick={() => navigate('/tasks')}>New task</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} label={`Previous ${view.toLowerCase()}`} onClick={() => setCurrentDate((date) => shiftDate(view, date, -1))} />
          <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <IconButton icon={ChevronRight} label={`Next ${view.toLowerCase()}`} onClick={() => setCurrentDate((date) => shiftDate(view, date, 1))} />
          <p className="ml-1 font-display text-base font-bold text-ink sm:text-lg">{periodLabel}</p>
        </div>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      {isLoading ? (
        <Card><LoadingState label="Loading your schedule" /></Card>
      ) : error ? (
        <Card><ErrorState title="Calendar could not load" description={error.message} action={<Button variant="secondary" onClick={handleRetry}>Retry</Button>} /></Card>
      ) : (
        <div className="animate-fade-up">
          {view === 'Month' && (
            <MonthView weeks={monthGrid.weeks} eventsByDay={eventsByDay} onSelectEvent={setSelectedEvent} onSelectDay={handleSelectDay} />
          )}
          {view === 'Week' && (
            <WeekView days={weekDays.days} eventsByDay={eventsByDay} onSelectEvent={setSelectedEvent} />
          )}
          {view === 'Day' && (
            <DayView events={events} onSelectEvent={setSelectedEvent} />
          )}
        </div>
      )}

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onUpdateTask={handleUpdateTask} />
      )}
    </div>
  )
}
