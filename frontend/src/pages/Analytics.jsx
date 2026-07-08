import { ArrowRight, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WorkloadMetricsGrid, WorkloadStatusCard } from '../components/WorkloadStatus'
import { Button, Card, EmptyState, PageHeader, Section } from '../components/ui'
import { useWorkload } from '../hooks/useWorkload'

export default function Analytics() {
  const navigate = useNavigate()
  const workloadQuery = useWorkload()
  const hasWorkload = !workloadQuery.isLoading && !workloadQuery.error && workloadQuery.summary

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Understand" title="Analytics" description="Useful patterns about workload, consistency, and effort. No vanity metrics." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="This week">
          <WorkloadMetricsGrid summary={workloadQuery.summary} isLoading={workloadQuery.isLoading} error={workloadQuery.error} />
        </Section>
        <WorkloadStatusCard summary={workloadQuery.summary} isLoading={workloadQuery.isLoading} error={workloadQuery.error} />
      </div>
      {!hasWorkload && (
        <Section title="Insights">
          <Card><EmptyState icon={BarChart3} title="No patterns to show yet" description="Add a few tasks and let the extension capture some activity — insights become useful once there's a work record to read." action={<Button variant="ghost" onClick={() => navigate('/activity')}>Learn about insights <ArrowRight size={15} /></Button>} /></Card>
        </Section>
      )}
    </div>
  )
}
