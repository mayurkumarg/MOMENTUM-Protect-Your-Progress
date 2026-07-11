import { useCallback, useMemo, useState } from 'react'
import { notesApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

// Notes for one workspace (entityType + entityId — a task today, a project
// later). Mirrors useTasks.js's optimistic add/update/remove shape.
export function useNotes(entityType, entityId) {
  const auth = useAuth()
  const [mutationError, setMutationError] = useState(null)
  const enabled = auth.isAuthenticated && Boolean(entityType) && Boolean(entityId)

  const loader = useCallback(() => notesApi.listNotes(entityType, entityId), [entityType, entityId])
  const query = useAsyncData(loader, { enabled, initialData: [] })

  const notes = useMemo(() => query.data || [], [query.data])

  const replaceNote = useCallback((note) => {
    query.setData((current) => (current || []).map((item) => (item.id === note.id ? note : item)))
  }, [query])

  const addNote = useCallback(async (note) => {
    setMutationError(null)
    const created = await notesApi.createNote({ entityType, entityId, ...note })
    query.setData((current) => [created, ...(current || [])])
    return created
  }, [query, entityType, entityId])

  const updateNote = useCallback(async (id, updates) => {
    setMutationError(null)
    const previous = query.data
    const currentNote = notes.find((note) => note.id === id)

    if (currentNote) {
      replaceNote({ ...currentNote, ...updates, updatedAt: new Date().toISOString() })
    }

    try {
      const updated = await notesApi.updateNote(id, updates)
      replaceNote(updated)
      return updated
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query, replaceNote, notes])

  const removeNote = useCallback(async (id) => {
    setMutationError(null)
    const previous = query.data
    query.setData((current) => (current || []).filter((note) => note.id !== id))

    try {
      return await notesApi.deleteNote(id)
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query])

  return {
    ...query,
    notes,
    error: query.error || mutationError,
    addNote,
    updateNote,
    removeNote,
    replaceNote,
  }
}
