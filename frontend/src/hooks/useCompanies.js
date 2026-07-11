import { useCallback, useMemo, useState } from 'react'
import { companyApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

// Mirrors useTasks.js's optimistic add/update/remove shape. The list
// endpoint returns a flat array (like Notes), not a {items, pagination}
// wrapper (like Tasks/Activities) — companies are a small, personal-scale
// collection with no pagination UI, same pragmatism as Notes.
export function useCompanies() {
  const auth = useAuth()
  const [mutationError, setMutationError] = useState(null)
  const loader = useCallback(() => companyApi.listCompanies(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: [] })

  const companies = useMemo(() => query.data || [], [query.data])

  const replaceCompany = useCallback((company) => {
    query.setData((current) => (current || []).map((item) => (item.id === company.id ? company : item)))
  }, [query])

  const addCompany = useCallback(async (company) => {
    setMutationError(null)
    const created = await companyApi.createCompany(company)
    query.setData((current) => [created, ...(current || [])])
    return created
  }, [query])

  const updateCompany = useCallback(async (id, updates) => {
    setMutationError(null)
    const previous = query.data
    const current = companies.find((company) => company.id === id)

    if (current) {
      replaceCompany({ ...current, ...updates, updatedAt: new Date().toISOString() })
    }

    try {
      const updated = await companyApi.updateCompany(id, updates)
      replaceCompany(updated)
      return updated
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query, replaceCompany, companies])

  const removeCompany = useCallback(async (id) => {
    setMutationError(null)
    const previous = query.data
    query.setData((current) => (current || []).filter((company) => company.id !== id))

    try {
      return await companyApi.deleteCompany(id)
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query])

  return {
    ...query,
    companies,
    error: query.error || mutationError,
    addCompany,
    updateCompany,
    removeCompany,
  }
}
