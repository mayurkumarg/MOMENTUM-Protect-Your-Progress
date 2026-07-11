import { ArrowLeft, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProgressRing } from '../components/AnalyticsCharts'
import CompanyAvatar from '../components/companies/CompanyAvatar'
import CompanyInfoForm from '../components/companies/CompanyInfoForm'
import ImportantDatesEditor from '../components/companies/ImportantDatesEditor'
import LinkedTasksSection from '../components/companies/LinkedTasksSection'
import StatusControl from '../components/companies/StatusControl'
import ConfirmDialog from '../components/ConfirmDialog'
import WorkspaceNotes from '../components/notes/WorkspaceNotes'
import { useToast } from '../components/ToastProvider'
import { Button, Card, ErrorState, IconButton, LoadingState, Section } from '../components/ui'
import { useCompanies } from '../hooks/useCompanies'
import { useTasks } from '../hooks/useTasks'
import { computePrepProgress } from '../utils/companies'

export default function CompanyDetail() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { companies, isLoading, error, refetch, updateCompany, removeCompany } = useCompanies()
  const company = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])

  const { tasks, updateTask, refetch: refetchTasks } = useTasks()
  const prepProgress = useMemo(() => (company ? computePrepProgress(company.id, tasks) : null), [company, tasks])

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSaveInfo = (updates) => updateCompany(companyId, updates)
  const handleUpdateStatus = (status) => updateCompany(companyId, { status })
  const handleUpdateDates = (importantDates) => updateCompany(companyId, { importantDates })

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await removeCompany(companyId)
      toast.success('Company deleted.')
      navigate('/placements')
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the company.')
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/placements')}>Back to Placements</Button>
        <Card><LoadingState label="Loading company" /></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/placements')}>Back to Placements</Button>
        <Card><ErrorState title="Could not load this company" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch(() => {})}>Retry</Button>} /></Card>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/placements')}>Back to Placements</Button>
        <Card><ErrorState title="Company not found" description="This company may have been deleted." action={<Button onClick={() => navigate('/placements')}>Go to Placements</Button>} /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" icon={ArrowLeft} className="mb-3 -ml-3" onClick={() => navigate('/placements')}>Back to Placements</Button>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-7">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyAvatar company={company} size={52} />
            <div className="min-w-0">
              <p className="eyebrow mb-1">Placement</p>
              <h1 className="truncate font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">{company.name}</h1>
              {company.role && <p className="mt-1 text-[15px] text-muted">{company.role}{company.location ? ` · ${company.location}` : ''}</p>}
            </div>
          </div>
          <IconButton icon={Trash2} label="Delete company" onClick={() => setConfirmDelete(true)} className="hover:bg-coral-soft hover:text-coral" />
        </div>
      </div>

      <Section title="Status">
        <Card className="p-5">
          <StatusControl company={company} onUpdateStatus={handleUpdateStatus} />
        </Card>
      </Section>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Section title="Company details">
          <CompanyInfoForm company={company} onSave={handleSaveInfo} />
        </Section>
        <Section title="Prep progress">
          <Card className="flex min-h-40 flex-col items-center justify-center p-5 text-center">
            {prepProgress === null ? (
              <p className="text-sm text-muted">Link a prep task below to start tracking progress.</p>
            ) : (
              <ProgressRing value={prepProgress} label="Prep tasks done" />
            )}
          </Card>
        </Section>
      </div>

      <Section title="Important dates" description="OA, interview rounds, HR — whatever this company's process looks like.">
        <Card className="p-5">
          <ImportantDatesEditor company={company} onUpdateDates={handleUpdateDates} />
        </Card>
      </Section>

      <Section title="Prep tasks" description="Momentum tasks linked to this company.">
        <LinkedTasksSection companyId={companyId} tasks={tasks} updateTask={updateTask} refetch={refetchTasks} />
      </Section>

      <WorkspaceNotes
        entityType="COMPANY"
        entityId={companyId}
        emptyStateDescription="Interview experiences, OA questions, research, strategy — keep everything about this company in one place."
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${company.name}"?`}
        description="This can't be undone. Linked tasks will be kept but unlinked; notes for this company will be deleted."
        confirmLabel="Delete"
        tone="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
