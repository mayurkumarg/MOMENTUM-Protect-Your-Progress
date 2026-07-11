import { formatDate, formatMinutes } from './format'

export const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
]

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

export const PRIORITY_TONE = { LOW: 'neutral', MEDIUM: 'yellow', HIGH: 'coral' }
export const PRIORITY_DOT = { LOW: 'bg-faint', MEDIUM: 'bg-yellow', HIGH: 'bg-coral' }
const PRIORITY_WEIGHT = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export const SORT_OPTIONS = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Recently added' },
  { value: 'title', label: 'Title A-Z' },
]

export const GROUP_OPTIONS = [
  { value: 'none', label: 'Time' },
  { value: 'category', label: 'Category' },
  { value: 'priority', label: 'Priority' },
]

export function mapTaskToWorkItem(task) {
  const completed = task.status === 'COMPLETED'

  return {
    ...task,
    completed,
    context: `${task.category || 'Task'} · due ${formatDate(task.deadline)}`,
    label: completed ? 'Done' : formatMinutes(Math.round((task.estimatedHours || 0) * 60)),
    tone: completed ? 'green' : task.category ? 'coral' : 'yellow',
  }
}

export function sortTasks(tasks, sortBy = 'deadline') {
  const sorted = [...tasks]

  if (sortBy === 'priority') {
    return sorted.sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 1) - (PRIORITY_WEIGHT[b.priority] ?? 1))
  }
  if (sortBy === 'created') {
    return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }
  if (sortBy === 'title') {
    return sorted.sort((a, b) => a.title.localeCompare(b.title))
  }

  // Default: deadline, soonest first — tasks without one sink to the end.
  return sorted.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return new Date(a.deadline) - new Date(b.deadline)
  })
}

// Alternative to the time-based splitTasks grouping below — buckets by
// category or priority instead, for when "what's overdue" matters less than
// "what area of my life is this." Returns null for 'none' so callers fall
// back to the default time-based view.
export function groupTasksBy(tasks, groupBy) {
  if (groupBy === 'category') {
    const groups = new Map()
    for (const task of tasks) {
      const key = task.category || 'Uncategorized'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(task)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
      .map(([label, groupTasks]) => ({ key: label, label, tasks: groupTasks }))
  }

  if (groupBy === 'priority') {
    return PRIORITY_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      tasks: tasks.filter((task) => (task.priority || 'MEDIUM') === option.value),
    })).filter((group) => group.tasks.length > 0)
  }

  return null
}

export function splitTasks(tasks) {
  const now = new Date()
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const pending = tasks.filter((task) => task.status !== 'COMPLETED')
  const completed = tasks.filter((task) => task.status === 'COMPLETED')

  return {
    today: pending.filter((task) => task.deadline && new Date(task.deadline) <= endOfToday),
    upcoming: pending.filter((task) => !task.deadline || new Date(task.deadline) > endOfToday),
    overdue: pending.filter((task) => task.deadline && new Date(task.deadline) < now),
    completed,
  }
}

export const DEFAULT_TASK_FILTERS = { timeframe: 'all', statuses: [], priorities: [], category: '', tags: [] }

export function hasActiveTaskFilters(filters) {
  return (
    filters.timeframe !== 'all' ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    Boolean(filters.category) ||
    (filters.tags || []).length > 0
  )
}

const isSameCalendarDay = (a, b) => a.toDateString() === b.toDateString()

export function applyTaskFilters(tasks, filters) {
  const { timeframe, statuses, priorities, category, tags } = filters
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 999)

  return tasks.filter((task) => {
    if (statuses.length && !statuses.includes(task.status)) return false
    if (priorities.length && !priorities.includes(task.priority || 'MEDIUM')) return false
    if (category && (task.category || '') !== category) return false
    if (tags && tags.length && !tags.every((tag) => (task.tags || []).includes(tag))) return false

    if (!task.deadline) return timeframe === 'all'
    const deadline = new Date(task.deadline)

    if (timeframe === 'today') return isSameCalendarDay(deadline, now)
    if (timeframe === 'week') return deadline <= weekEnd
    if (timeframe === 'overdue') return deadline < now && task.status !== 'COMPLETED'

    return true
  })
}

