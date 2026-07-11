import { useMemo } from 'react'
import { useTasks } from './useTasks'
import { useActivities } from './useActivities'
import { getVisibleRange } from '../utils/calendar'
import { normalizeEvents, groupEventsByDay } from '../utils/calendarEvents'

// Composes the EXISTING useTasks/useActivities hooks (no new fetch/async-state
// logic) scoped to the currently visible Day/Week/Month range, via the same
// deadlineFrom/deadlineTo and dateFrom/dateTo filters the Tasks/Activity pages
// already use. Re-fetches only when the visible range actually changes.
export function useCalendarEvents(view, currentDate) {
  const range = useMemo(() => getVisibleRange(view, currentDate), [view, currentDate])

  // limit: 100 — both list endpoints hard-clamp to 100 server-side, so this
  // is the real ceiling regardless of what's requested (generous for one
  // visible range at this app's scale).
  const taskParams = useMemo(() => ({
    deadlineFrom: range.start.toISOString(),
    deadlineTo: range.end.toISOString(),
    limit: 100,
  }), [range])

  const activityParams = useMemo(() => ({
    dateFrom: range.start.toISOString(),
    dateTo: range.end.toISOString(),
    limit: 100,
  }), [range])

  const tasksQuery = useTasks(taskParams)
  const activitiesQuery = useActivities(activityParams)

  const events = useMemo(
    () => normalizeEvents({ tasks: tasksQuery.tasks, activities: activitiesQuery.activities }),
    [tasksQuery.tasks, activitiesQuery.activities]
  )

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events])

  return {
    events,
    eventsByDay,
    range,
    isLoading: tasksQuery.isLoading || activitiesQuery.isLoading,
    isFetching: tasksQuery.isFetching || activitiesQuery.isFetching,
    error: tasksQuery.error || activitiesQuery.error,
    refetch: () => Promise.all([tasksQuery.refetch(), activitiesQuery.refetch()]),
    updateTask: tasksQuery.updateTask,
  }
}
