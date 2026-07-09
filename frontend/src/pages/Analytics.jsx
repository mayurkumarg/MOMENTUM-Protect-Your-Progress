import { ArrowRight, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ActivityHeatmap, PlatformBreakdownBars, StatTile, TaskCompletionPanel } from '../components/AnalyticsCharts'
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section } from '../components/ui'
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary'

export default function Analytics() {
  const navigate = useNavigate()
  const { summary, isLoading, error, refetch } = useAnalyticsSummary()

  const isEmpty = summary && summary.totals.totalActivities === 0 && summary.taskCompletion.total === 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Understand" title="Analytics" description="Useful patterns about workload, consistency, and effort. No vanity metrics." />

      {isLoading ? (
        <Card><LoadingState label="Reading your activity" /></Card>
      ) : error ? (
        <Card><ErrorState title="Analytics could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch(() => {})}>Retry</Button>} /></Card>
      ) : isEmpty ? (
        <Section title="Insights">
          <Card><EmptyState icon={BarChart3} title="No patterns to show yet" description="Add a few tasks and let the extension capture some activity — insights become useful once there's a work record to read." action={<Button variant="ghost" onClick={() => navigate('/activity')}>Learn about insights <ArrowRight size={15} /></Button>} /></Card>
        </Section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Activity, last 14 weeks" value={summary.totals.totalActivities} deltaLabel={summary.totals.avgMinutesPerActivity ? `~${summary.totals.avgMinutesPerActivity} min avg per problem` : undefined} />
            <StatTile label="Current streak" value={`${summary.streak.current}d`} deltaLabel={`Longest: ${summary.streak.longest}d`} />
            <StatTile
              label="This week vs last"
              value={summary.weeklyComparison.thisWeek}
              delta={summary.weeklyComparison.deltaPct}
              deltaLabel={`${summary.weeklyComparison.lastWeek} last week`}
            />
            <StatTile label="Task completion" value={`${summary.taskCompletion.completionRate}%`} deltaLabel={`${summary.taskCompletion.completed} of ${summary.taskCompletion.total} tasks`} />
          </div>

          <Section title="Activity heatmap" description="Coding activity captured over the last 14 weeks.">
            <ActivityHeatmap heatmap={summary.heatmap} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Platforms">
              {summary.platformBreakdown.length ? (
                <PlatformBreakdownBars platformBreakdown={summary.platformBreakdown} />
              ) : (
                <Card><EmptyState compact title="No platform activity yet" description="Solved problems from a connected platform will show up here." /></Card>
              )}
            </Section>
            <Section title="Task completion">
              <TaskCompletionPanel taskCompletion={summary.taskCompletion} />
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
