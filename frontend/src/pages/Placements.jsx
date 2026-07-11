import { Briefcase, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { StatTile } from '../components/AnalyticsCharts'
import CompanyCard from '../components/companies/CompanyCard'
import CompanyForm from '../components/companies/CompanyForm'
import Modal from '../components/Modal'
import { useToast } from '../components/ToastProvider'
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'
import { useCompanies } from '../hooks/useCompanies'
import { COMPANY_STATUS_OPTIONS, computePlacementStats, sortCompaniesByRecent } from '../utils/companies'

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

export default function Placements() {
  const toast = useToast()
  const { companies, isLoading, error, refetch, addCompany } = useCompanies()
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const stats = useMemo(() => computePlacementStats(companies), [companies])

  const visibleCompanies = useMemo(() => {
    let list = sortCompaniesByRecent(companies)
    if (statusFilter !== 'ALL') list = list.filter((company) => company.status === statusFilter)
    const term = searchTerm.trim().toLowerCase()
    if (term) list = list.filter((company) => company.name.toLowerCase().includes(term) || (company.role || '').toLowerCase().includes(term))
    return list
  }, [companies, statusFilter, searchTerm])

  const handleCreate = async (payload) => {
    setIsSaving(true)
    try {
      const created = await addCompany(payload)
      setShowForm(false)
      toast.success('Company added.')
      return created
    } catch (error) {
      toast.error(error.message || 'Could not add company.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Placements"
        title="Placement Tracker"
        description="Every company, its status, prep work, and notes — in one place instead of a spreadsheet."
        actions={<Button icon={Plus} onClick={() => setShowForm(true)}>New company</Button>}
      />

      {isLoading ? (
        <Card><LoadingState label="Loading your placement tracker" /></Card>
      ) : error ? (
        <Card><ErrorState title="Placements could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>} /></Card>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Start tracking your placement journey"
            description="Add a company to track its status, prep tasks, key dates, and notes — all in one place."
            action={<Button icon={Plus} onClick={() => setShowForm(true)}>Add your first company</Button>}
          />
        </Card>
      ) : (
        <div className="animate-fade-up space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total companies" value={stats.total} />
            <StatTile label="Applied" value={stats.applied} />
            <StatTile label="Preparing" value={stats.preparing} />
            <StatTile label="Interviews" value={stats.interviews} />
            <StatTile label="Offers" value={stats.offers} />
            <StatTile label="Rejections" value={stats.rejections} />
            <StatTile label="Upcoming interviews" value={stats.upcomingInterviews} />
            <StatTile label="Upcoming OAs" value={stats.upcomingOAs} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>All</FilterChip>
              {COMPANY_STATUS_OPTIONS.map((option) => (
                <FilterChip key={option.value} active={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>{option.label}</FilterChip>
              ))}
            </div>
            <div className="w-full max-w-xs">
              <input
                aria-label="Search companies"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="focus-ring h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-copy placeholder:text-faint"
              />
            </div>
          </div>

          {visibleCompanies.length === 0 ? (
            <Card><EmptyState compact icon={Search} title="No matching companies" description="Try a different search or filter." /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCompanies.map((company) => <CompanyCard key={company.id} company={company} />)}
            </div>
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} labelledBy="new-company-title">
        <h2 id="new-company-title" className="font-display text-[15px] font-bold text-ink">Add a company</h2>
        <div className="mt-4">
          <CompanyForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} isSaving={isSaving} />
        </div>
      </Modal>
    </div>
  )
}
