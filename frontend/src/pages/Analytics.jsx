import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ActivityHeatmap,
  DifficultyBreakdown,
  GithubActivityTeaser,
  PlatformBreakdownBars,
  ProductivityTrend,
  RecentActivityList,
  StatTile,
  TaskCompletionRing,
  TodayHeroCard,
} from '../components/AnalyticsCharts'
import { useToast } from '../components/ToastProvider'
import { Button, Card, EmptyState, ErrorState, PageHeader, Section, Skeleton } from '../components/ui'
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary'
import { useDsaSummary } from '../hooks/useDsaSummary'
import { useGithubActivity } from '../hooks/useGithubActivity'
import { useGithubConnect } from '../hooks/useGithubConnect'
import { useGithubOAuthReturn } from '../hooks/useGithubOAuthReturn'
import { useTasks } from '../hooks/useTasks'
import { formatDurationHuman } from '../utils/format'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}

export default function Analytics() {
  const navigate = useNavigate()
  const toast = useToast()
  const analyticsQuery = useAnalyticsSummary()
  const dsaQuery = useDsaSummary()
  const tasksQuery = useTasks()
  const github = useGithubActivity()
  const githubConnect = useGithubConnect('/analytics')
  useGithubOAuthReturn(github.refetch)

  const tasksCompletedToday = useMemo(() => {
    const todayKey = new Date().toDateString()
    return tasksQuery.tasks.filter(
      (task) => task.status === 'COMPLETED' && task.completedAt && new Date(task.completedAt).toDateString() === todayKey
    ).length
  }, [tasksQuery.tasks])

  const isLoading = analyticsQuery.isLoading || dsaQuery.isLoading
  const error = analyticsQuery.error || dsaQuery.error
  const summary = analyticsQuery.summary
  const dsaSummary = dsaQuery.summary

  const handleRetry = () => {
    Promise.all([analyticsQuery.refetch(), dsaQuery.refetch()]).catch((retryError) => {
      toast.error(retryError.message || 'Still unable to load. Please try again.')
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Understand" title="Analytics" description="A clear read on today's effort, this week's momentum, and the last 14 weeks. No vanity metrics." />

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : error ? (
        <Card><ErrorState title="Analytics could not load" description={error.message} action={<Button variant="secondary" onClick={handleRetry}>Retry</Button>} /></Card>
      ) : (
        <div className="animate-fade-up space-y-8">
          <TodayHeroCard
            problemsSolvedToday={dsaSummary?.problemsSolvedToday || 0}
            tasksCompletedToday={tasksCompletedToday}
            timeTodayLabel={formatDurationHuman((dsaSummary?.totalMinutesToday || 0) * 60) || '0m'}
            streakCurrent={summary.streak.current}
            streakLongest={summary.streak.longest}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="This week vs last"
              value={summary.weeklyComparison.thisWeek}
              delta={summary.weeklyComparison.deltaPct}
              deltaLabel={`${summary.weeklyComparison.lastWeek} last week`}
            />
            <StatTile label="Activity, last 14 weeks" value={summary.totals.totalActivities} deltaLabel={summary.totals.avgMinutesPerActivity ? `~${summary.totals.avgMinutesPerActivity} min avg per problem` : undefined} />
            <StatTile label="Active days" value={summary.totals.activeDays} deltaLabel={`out of ${summary.range.days} tracked days`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <Section title="Productivity trend" description="Total activity per week, last 8 weeks.">
              <ProductivityTrend heatmap={summary.heatmap} />
            </Section>
            <Section title="Task completion" description="All time.">
              <TaskCompletionRing taskCompletion={summary.taskCompletion} />
            </Section>
          </div>

          <Section title="Activity heatmap" description="Coding activity captured over the last 14 weeks.">
            <ActivityHeatmap heatmap={summary.heatmap} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Today's difficulty mix">
              <DifficultyBreakdown difficultyCounts={dsaSummary?.difficultyCounts} />
            </Section>
            <Section title="Platforms" description="Last 14 weeks.">
              {summary.platformBreakdown.length ? (
                <PlatformBreakdownBars platformBreakdown={summary.platformBreakdown} />
              ) : (
                <Card><EmptyState compact title="No platform activity yet" description="Solved problems from a connected platform will show up here." /></Card>
              )}
            </Section>
            <Section title="GitHub">
              <GithubActivityTeaser
                connected={Boolean(github.dashboard?.repository)}
                repositoryName={github.dashboard?.repository?.fullName}
                connecting={githubConnect.connecting}
                stats={github.dashboard?.repository ? { synced: github.dashboard.stats.synced, currentStreak: github.dashboard.consistency.currentStreak } : null}
                onConnect={githubConnect.connect}
                onView={() => navigate('/github')}
              />
            </Section>
          </div>

          <Section title="Recent activity" description="Today's solves, most recent first.">
            <RecentActivityList recent={dsaSummary?.recent} />
          </Section>
        </div>
      )}
    </div>
  )
}
