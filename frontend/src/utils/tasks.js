import { formatDate, formatMinutes } from './format'

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
