import { useCallback, useMemo, useState } from 'react'
import { taskApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useTasks(params = {}) {
  const auth = useAuth()
  const [mutationError, setMutationError] = useState(null)
  const loader = useCallback(() => taskApi.getTasks(params), [JSON.stringify(params)])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: { tasks: [], pagination: null } })

  const tasks = useMemo(() => query.data?.tasks || [], [query.data])

  const replaceTask = useCallback((task) => {
    query.setData((current) => ({
      ...(current || {}),
      tasks: (current?.tasks || []).map((item) => (item.id === task.id ? task : item)),
    }))
  }, [query])

  const addTask = useCallback(async (task) => {
    setMutationError(null)
    const created = await taskApi.createTask(task)
    query.setData((current) => ({
      ...(current || {}),
      tasks: [created, ...(current?.tasks || [])].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)),
    }))
    return created
  }, [query])

  const updateTask = useCallback(async (id, updates) => {
    setMutationError(null)
    const previous = query.data
    const currentTask = tasks.find((task) => task.id === id)

    if (currentTask) {
      replaceTask({ ...currentTask, ...updates, updatedAt: new Date().toISOString() })
    }

    try {
      const updated = await taskApi.updateTask(id, updates)
      replaceTask(updated)
      return updated
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query, replaceTask, tasks])

  const removeTask = useCallback(async (id) => {
    setMutationError(null)
    const previous = query.data
    query.setData((current) => ({
      ...(current || {}),
      tasks: (current?.tasks || []).filter((task) => task.id !== id),
    }))

    try {
      return await taskApi.deleteTask(id)
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query])

  return {
    ...query,
    tasks,
    error: query.error || mutationError,
    addTask,
    updateTask,
    removeTask,
  }
}
