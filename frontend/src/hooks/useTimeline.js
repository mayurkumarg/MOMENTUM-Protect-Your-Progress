import { useMemo } from 'react'
import { useActivities } from './useActivities'
import { useTasks } from './useTasks'

export function useTimeline() {
  const taskQuery = useTasks()
  const activityQuery = useActivities()

  const items = useMemo(() => {
    const taskItems = taskQuery.tasks.flatMap((task) => {
      const created = task.createdAt ? [{
        id: `task-created-${task.id}`,
        type: 'task-created',
        title: task.title,
        context: task.category || 'Task',
        timestamp: task.createdAt,
        source: 'Task created',
      }] : []

      const completed = task.completedAt ? [{
        id: `task-completed-${task.id}`,
        type: 'task-completed',
        title: task.title,
        context: task.category || 'Task',
        timestamp: task.completedAt,
        source: 'Task completed',
      }] : []

      return [...created, ...completed]
    })

    const activityItems = activityQuery.activities.map((activity) => ({
      id: `activity-${activity.id}`,
      type: 'coding-activity',
      title: activity.title,
      context: activity.metadata?.platform || activity.source || activity.activityType,
      timestamp: activity.activityDate || activity.createdAt,
      source: 'Coding activity',
      durationMinutes: activity.durationMinutes,
    }))

    return [...taskItems, ...activityItems]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [activityQuery.activities, taskQuery.tasks])

  return {
    items,
    isLoading: taskQuery.isLoading || activityQuery.isLoading,
    isFetching: taskQuery.isFetching || activityQuery.isFetching,
    error: taskQuery.error || activityQuery.error,
    refetch: () => Promise.all([taskQuery.refetch(), activityQuery.refetch()]),
  }
}
