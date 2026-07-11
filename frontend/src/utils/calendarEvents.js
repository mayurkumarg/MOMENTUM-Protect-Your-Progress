// Turns raw Tasks + Activities into one normalized, source-tagged event shape
// that every calendar/timeline component renders generically. Adding a future
// source (Commitments, Placement Tracker, an external calendar sync) is a new
// normalizer function + a new spread in normalizeEvents — no view-component
// changes, matching the entityType/entityId extensibility pattern already
// used by the Notes/Workspace feature, applied here at the frontend layer
// since the calendar has no backend model of its own.

import { PRIORITY_TONE } from './tasks'

export function normalizeTaskEvent(task) {
  if (!task?.deadline) return null
  const date = new Date(task.deadline)
  if (Number.isNaN(date.getTime())) return null

  const isOverdue = task.status !== 'COMPLETED' && date < new Date()
  const tone = isOverdue ? 'coral' : task.status === 'COMPLETED' ? 'green' : (PRIORITY_TONE[task.priority] || 'neutral')

  return {
    id: `task-${task.id}`,
    source: 'TASK',
    title: task.title,
    date,
    status: task.status,
    tone,
    isOverdue,
    meta: {
      priority: task.priority,
      category: task.category,
      progress: task.progress,
      subtaskCount: task.subtasks?.length || 0,
      reminder: task.reminder,
      estimatedHours: task.estimatedHours,
    },
    raw: task,
  }
}

export function normalizeActivityEvent(activity) {
  const rawDate = activity?.activityDate || activity?.createdAt
  if (!rawDate) return null
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return null

  return {
    id: `activity-${activity.id}`,
    source: 'ACTIVITY',
    title: activity.title,
    date,
    status: 'LOGGED',
    tone: 'green',
    isOverdue: false,
    meta: {
      durationMinutes: activity.durationMinutes,
      durationSeconds: activity.durationSeconds,
      isEstimatedDuration: activity.isEstimatedDuration,
      platform: activity.metadata?.platform || null,
      activityType: activity.activityType,
      activitySource: activity.source,
    },
    raw: activity,
  }
}

export function normalizeEvents({ tasks = [], activities = [] }) {
  const events = [...tasks.map(normalizeTaskEvent), ...activities.map(normalizeActivityEvent)].filter(Boolean)
  return events.sort((a, b) => a.date - b.date)
}

export function groupEventsByDay(events) {
  const map = new Map()
  for (const event of events) {
    const key = event.date.toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(event)
  }
  return map
}

// Mirrors AnalyticsCharts.jsx's levelForCount (ratio-to-max bucketed into 5
// levels) — kept as a separate function since calendar day-density and
// heatmap activity-count are different inputs, but the visual language
// (0-4 intensity levels) stays consistent with the rest of the app.
export function eventDensityLevel(count, maxCount) {
  if (count === 0) return 0
  const ratio = count / Math.max(1, maxCount)
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}
