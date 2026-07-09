import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ExternalLink, Flame, GitBranch, GitCommitHorizontal, Github, Rocket, Sparkles, TrendingUp } from 'lucide-react'
import { HeroStat, StatTile } from '../components/AnalyticsCharts'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Section } from '../components/ui'
import { useToast } from '../components/ToastProvider'
import { useGithubActivity } from '../hooks/useGithubActivity'
import { useGithubConnect } from '../hooks/useGithubConnect'
import { useGithubOAuthReturn } from '../hooks/useGithubOAuthReturn'
import { githubApi } from '../api'
import { formatDate, formatDateTime } from '../utils/format'

const DIFFICULTY_TONE = { Easy: 'green', Medium: 'yellow', Hard: 'coral' }

// Placeholder tiles that show where this page grows next — no fake data,
// just a visible extension point so future GitHub features slot in without
// another redesign.
const COMING_SOON = [
  { icon: Rocket, title: 'Pull requests', detail: 'Track PRs opened from your practice repo.' },
  { icon: Sparkles, title: 'Issue activity', detail: 'Surface open issues if you start tracking bugs here.' },
]

function GithubHero({ status, stats, consistency, weeklyComparison }) {
  const repository = status.repository
  const weeklyDelta = weeklyComparison.lastWeek > 0
    ? Math.round(((weeklyComparison.thisWeek - weeklyComparison.lastWeek) / weeklyComparison.lastWeek) * 100)
    : weeklyComparison.thisWeek > 0 ? 100 : 0

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Repository</p>
          <div className="flex items-center gap-3">
            {status.githubAvatar && <img src={status.githubAvatar} alt="" className="size-11 shrink-0 rounded-full border border-line" />}
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-extrabold leading-tight text-ink sm:text-[28px]">{repository.name}</p>
              <p className="truncate text-sm text-muted">{repository.fullName}</p>
            </div>
          </div>
          <p className="mt-2.5 max-w-sm text-sm leading-5 text-muted">
            Connected as <span className="font-semibold text-copy">{status.githubUsername}</span>
            {status.connectedAt && <> · since {formatDate(status.connectedAt)}</>}
          </p>
          <a href={repository.htmlUrl} target="_blank" rel="noreferrer" className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            View repository on GitHub <ExternalLink size={12} />
          </a>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <HeroStat
            icon={Flame}
            tone="coral"
            value={`${consistency.currentStreak}d`}
            label="sync streak"
            sublabel={consistency.longestStreak > consistency.currentStreak ? `best ${consistency.longestStreak}d` : undefined}
          />
          <HeroStat
            icon={TrendingUp}
            tone="accent"
            value={weeklyComparison.thisWeek}
            label="synced this week"
            sublabel={weeklyComparison.lastWeek ? `${weeklyDelta >= 0 ? '+' : ''}${weeklyDelta}% vs last week` : undefined}
          />
          <HeroStat icon={GitCommitHorizontal} tone="muted" value={stats.synced} label="total synced" />
        </div>
      </div>
    </Card>
  )
}

function ConsistencyStrip({ last7Days }) {
  const maxCount = Math.max(1, ...last7Days.map((day) => day.count))

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between gap-2">
        {last7Days.map((day) => {
          const height = day.count === 0 ? 6 : Math.max(10, Math.round((day.count / maxCount) * 32))
          const label = new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-8 w-full items-end justify-center">
                <div
                  title={`${day.date}: ${day.count} synced`}
                  className={`w-3.5 rounded-sm transition-all duration-300 ${day.count > 0 ? 'bg-accent' : 'bg-surface-subtle'}`}
                  style={{ height }}
                />
              </div>
              <span className="text-[10px] font-medium text-faint">{label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function CommitRow({ commit }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted">
        <GitCommitHorizontal size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-copy">{commit.message}</p>
        <p className="mt-0.5 text-xs text-faint">{commit.author}{commit.date ? ` · ${formatDateTime(commit.date)}` : ''}</p>
      </div>
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        title="View commit on GitHub"
        className="focus-ring shrink-0 rounded px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-surface-subtle hover:text-ink"
      >
        {commit.sha}
      </a>
    </div>
  )
}

function SyncedRow({ entry }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
        <Check size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-copy">{entry.title}</p>
        <p className="mt-0.5 text-xs text-faint">{formatDateTime(entry.solvedAt)} · {entry.platform}</p>
      </div>
      <Badge tone={DIFFICULTY_TONE[entry.difficulty] || 'neutral'}>{entry.difficulty}</Badge>
      {entry.commitUrl && (
        <a
          href={entry.commitUrl}
          target="_blank"
          rel="noreferrer"
          title="View commit on GitHub"
          className="focus-ring grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-subtle hover:text-ink"
        >
          <GitCommitHorizontal size={16} />
        </a>
      )}
    </div>
  )
}

function AttentionRow({ entry, onRetry, isRetrying }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-coral-soft text-coral">
        <AlertTriangle size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-copy">{entry.title}</p>
        <p className="mt-0.5 truncate text-xs text-faint">{entry.error || 'Sync failed'}</p>
      </div>
      <Button variant="secondary" className="h-8 shrink-0 px-3 text-xs" onClick={() => onRetry(entry.id)} disabled={isRetrying}>
        {isRetrying ? 'Retrying...' : 'Retry'}
      </Button>
    </div>
  )
}

function ComingSoonTile({ icon: Icon, title, detail }) {
  return (
    <Card className="flex items-start gap-3 border-dashed p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-copy">{title}</p>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-faint">{detail}</p>
      </div>
    </Card>
  )
}

export default function GitHubActivity() {
  const navigate = useNavigate()
  const toast = useToast()
  const { dashboard, isLoading, error, refetch } = useGithubActivity()
  const { connecting, connect } = useGithubConnect('/github')
  const [retryingId, setRetryingId] = useState(null)

  useGithubOAuthReturn(refetch)

  const handleRetry = async (activityId) => {
    setRetryingId(activityId)
    try {
      await githubApi.retryGithubSync(activityId)
      toast.success('Retry queued — it should sync shortly.')
      refetch()
    } catch (retryError) {
      toast.error(retryError.message || 'Could not queue a retry.')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Develop"
        title="GitHub"
        description="A quick read on your synced coding journal — commits and sync health, not a GitHub clone."
      />

      {isLoading ? (
        <Card><LoadingState label="Reading GitHub activity" /></Card>
      ) : error ? (
        <Card>
          <ErrorState
            title="GitHub activity could not load"
            description={error.message}
            action={<Button variant="secondary" onClick={() => refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>}
          />
        </Card>
      ) : !dashboard?.connected ? (
        <Card>
          <EmptyState
            icon={Github}
            title="GitHub isn't connected yet"
            description="Connect your GitHub account to start building an automatic coding journal — right here, no need to visit Settings."
            action={<Button onClick={connect} disabled={connecting}>{connecting ? 'Redirecting to GitHub...' : 'Connect GitHub'}</Button>}
          />
        </Card>
      ) : !dashboard.repository ? (
        <Card>
          <EmptyState
            icon={Github}
            title="Choose a repository"
            description="You're connected to GitHub as a repository — pick or create one in Settings to start syncing."
            action={<Button onClick={() => navigate('/settings')}>Choose repository in Settings</Button>}
          />
        </Card>
      ) : (
        <div className="animate-fade-up space-y-8">
          <GithubHero status={dashboard} stats={dashboard.stats} consistency={dashboard.consistency} weeklyComparison={dashboard.weeklyComparison} />

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Pending sync" value={dashboard.stats.pending} />
            <StatTile label="Needs attention" value={dashboard.stats.failed} />
            <StatTile label="Last synced" value={dashboard.stats.lastSyncedAt ? formatDateTime(dashboard.stats.lastSyncedAt) : '—'} />
          </div>

          <Section title="Coding consistency" description="Days with at least one problem synced, last 7 days.">
            <ConsistencyStrip last7Days={dashboard.consistency.last7Days} />
          </Section>

          {dashboard.needsAttention.length > 0 && (
            <Section title="Needs attention" description="Problems that couldn't sync yet. Momentum retries automatically, or you can retry now.">
              <Card className="overflow-hidden">
                {dashboard.needsAttention.map((entry) => (
                  <AttentionRow key={entry.id} entry={entry} onRetry={handleRetry} isRetrying={retryingId === entry.id} />
                ))}
              </Card>
            </Section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Recent commits" description="Straight from GitHub — includes anything you've committed by hand too.">
              {dashboard.recentCommits.length ? (
                <Card className="overflow-hidden">
                  {dashboard.recentCommits.map((commit) => <CommitRow key={commit.sha} commit={commit} />)}
                </Card>
              ) : (
                <Card>
                  <EmptyState compact icon={GitCommitHorizontal} title="No commits yet" description="Commits will show up here once your first problem syncs." />
                </Card>
              )}
            </Section>

            <Section title="Recently synced" description="Solved problems Momentum has already committed to your journal.">
              {dashboard.recentSynced.length ? (
                <Card className="overflow-hidden">
                  {dashboard.recentSynced.map((entry) => <SyncedRow key={entry.id} entry={entry} />)}
                </Card>
              ) : (
                <Card>
                  <EmptyState compact icon={Check} title="Nothing synced yet" description="Solve a problem on a connected platform — it'll show up here once synced." />
                </Card>
              )}
            </Section>
          </div>

          <Section title="More from GitHub" description="Built to grow — more of your GitHub activity will surface here over time.">
            <div className="grid gap-4 md:grid-cols-2">
              {COMING_SOON.map((item) => <ComingSoonTile key={item.title} {...item} />)}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
