import { useMemo } from 'react'
import { useActivities } from './useActivities'
import { useTasks } from './useTasks'
import { isSameDay } from '../utils/calendar'
import { splitTasks } from '../utils/tasks'

const UPCOMING_LIMIT = 5
const RECENT_LIMIT = 5

// Pure section builder — takes already-fetched tasks/activities so a caller
// that already holds those lists (e.g. the Activity page) can build the
// timeline without triggering a second fetch. Sectioned (overdue / today /
// upcoming / recent), not one flat chronological feed — a task deadline
// ("due by") and an activity timestamp ("happened at") are different time
// semantics, and interleaving "3 days overdue" with "completed 2 hours ago"
// on one line needs a heavier visual language than this app has. Each section
// is built from splitTasks()'s existing classification (Overview.jsx relies
// on the same buckets) rather than new date-comparison logic.
export function buildTimelineSections(tasks = [], activities = []) {
  const now = new Date()
  const { overdue, today, upcoming, completed } = splitTasks(tasks)

  // splitTasks' `today` bucket is "pending, deadline <= end of today" —
  // that also matches anything already overdue. Excluded here so a task
  // never shows in both the Overdue and Today sections at once.
  const overdueIds = new Set(overdue.map((task) => task.id))
  const dueTodayTasks = today.filter((task) => !overdueIds.has(task.id))

  const isToday = (value) => value && isSameDay(new Date(value), now)

  const todaysActivities = activities.filter((activity) => isToday(activity.activityDate))
  const todaysCompletedTasks = completed.filter((task) => isToday(task.completedAt))
  const pastCompletedTasks = completed.filter((task) => task.completedAt && !isToday(task.completedAt))
  const pastActivities = activities.filter((activity) => !isToday(activity.activityDate))

  const toTaskItem = (type) => (task) => ({
    id: `${type}-${task.id}`,
    type,
    title: task.title,
    context: task.category || 'Task',
    timestamp: type === 'task-completed' ? task.completedAt : task.deadline,
    priority: task.priority,
  })

  const toActivityItem = (activity) => ({
    id: `activity-${activity.id}`,
    type: 'coding-activity',
    title: activity.title,
    context: activity.metadata?.platform || activity.source,
    timestamp: activity.activityDate,
    durationMinutes: activity.durationMinutes,
    // Carry the precise seconds through too so the timeline can show the real
    // solving time (e.g. "1m 30s") instead of the coarse rounded minutes — the
    // same durationSeconds every other activity view already prefers.
    durationSeconds: activity.durationSeconds,
  })

  const byTimeAsc = (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  const byTimeDesc = (a, b) => new Date(b.timestamp) - new Date(a.timestamp)

  return {
    overdue: overdue.map(toTaskItem('task-overdue')).sort(byTimeAsc),
    today: [
      ...dueTodayTasks.map(toTaskItem('task-due')),
      ...todaysCompletedTasks.map(toTaskItem('task-completed')),
      ...todaysActivities.map(toActivityItem),
    ].sort(byTimeAsc),
    upcoming: upcoming.map(toTaskItem('task-upcoming')).sort(byTimeAsc).slice(0, UPCOMING_LIMIT),
    recent: [
      ...pastCompletedTasks.map(toTaskItem('task-completed')),
      ...pastActivities.map(toActivityItem),
    ].sort(byTimeDesc).slice(0, RECENT_LIMIT),
  }
}

export function useTimeline() {
  const taskQuery = useTasks()
  const activityQuery = useActivities()

  const sections = useMemo(
    () => buildTimelineSections(taskQuery.tasks, activityQuery.activities),
    [taskQuery.tasks, activityQuery.activities]
  )

  return {
    sections,
    isLoading: taskQuery.isLoading || activityQuery.isLoading,
    isFetching: taskQuery.isFetching || activityQuery.isFetching,
    error: taskQuery.error || activityQuery.error,
    refetch: () => Promise.all([taskQuery.refetch(), activityQuery.refetch()]),
  }
}
