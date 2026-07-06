import { Activity, ArrowRight, BarChart3, CircleDot, GitCommitHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, PageHeader, Section, SetupPrompt } from '../components/ui'

export default function Analytics() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Understand" title="Analytics" description="Useful patterns about workload, consistency, and effort. No vanity metrics." />
      <SetupPrompt title="Analytics needs a little history" description="Connect activity sources and use Momentum for a few days. Insights will become more useful as your work record grows." actionLabel="Connect activity" />
      <Section title="What Momentum will help you understand">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Activity, title: 'Workload balance', text: 'See when your plan asks for more than your available time.' },
            { icon: GitCommitHorizontal, title: 'Effort patterns', text: 'Understand which kinds of work receive your real attention.' },
            { icon: CircleDot, title: 'Consistency', text: 'Notice sustainable rhythms without turning every day into a score.' },
          ].map(({ icon: Icon, title, text }) => <Card key={title} className="p-5"><div className="mb-8 grid size-9 place-items-center rounded-md bg-accent-soft text-accent"><Icon size={17} /></div><p className="font-display text-[15px] font-bold">{title}</p><p className="mt-2 text-sm leading-5 text-muted">{text}</p></Card>)}
        </div>
      </Section>
      <Section title="Insights">
        <Card><EmptyState icon={BarChart3} title="No patterns to show yet" description="When there is enough reliable activity, clear and actionable observations will appear here." action={<Button variant="ghost" onClick={() => navigate('/activity')}>Learn about insights <ArrowRight size={15} /></Button>} /></Card>
      </Section>
    </div>
  )
}
