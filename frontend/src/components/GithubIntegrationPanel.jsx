import { useState } from 'react'
import { ExternalLink, Github, GitBranch, LoaderCircle, Plus } from 'lucide-react'
import { Badge, Button, Card, Input, SegmentedControl } from './ui'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './ToastProvider'
import { githubApi } from '../api'
import { useGithubConnect } from '../hooks/useGithubConnect'
import { useGithubIntegration } from '../hooks/useGithubIntegration'
import { useGithubOAuthReturn } from '../hooks/useGithubOAuthReturn'

const DEFAULT_REPO_NAME = 'Momentum-DSA-Journal'
const MODES = ['Create new', 'Use existing']

function RepoRow({ repo, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(repo)}
      disabled={disabled}
      className="focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-copy">{repo.fullName}</p>
        <p className="mt-0.5 truncate text-xs text-faint">{repo.description || 'No description'}</p>
      </div>
      <Badge tone={repo.private ? 'coral' : 'neutral'}>{repo.private ? 'Private' : 'Public'}</Badge>
    </button>
  )
}

export default function GithubIntegrationPanel() {
  const toast = useToast()
  const { status, isLoading, refetch } = useGithubIntegration()
  const { connecting, connect } = useGithubConnect('/settings')

  const [showPicker, setShowPicker] = useState(false)
  const [mode, setMode] = useState('Create new')
  const [repoName, setRepoName] = useState(DEFAULT_REPO_NAME)
  const [repoDescription, setRepoDescription] = useState('')
  const [visibility, setVisibility] = useState('Private')
  const [existingRepos, setExistingRepos] = useState(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useGithubOAuthReturn(refetch)

  const loadExistingRepos = async () => {
    setLoadingRepos(true)
    try {
      const repos = await githubApi.listGithubRepos()
      setExistingRepos(repos)
    } catch (error) {
      toast.error(error.message || 'Could not load your repositories.')
    } finally {
      setLoadingRepos(false)
    }
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    if (nextMode === 'Use existing' && !existingRepos && !loadingRepos) {
      loadExistingRepos()
    }
  }

  const openPicker = (initialMode) => {
    setMode(initialMode)
    setShowPicker(true)
    if (initialMode === 'Use existing' && !existingRepos) {
      loadExistingRepos()
    }
  }

  const handleCreate = async () => {
    if (!repoName.trim()) {
      toast.error('Repository name is required.')
      return
    }
    setSubmitting(true)
    try {
      await githubApi.createGithubRepo({
        name: repoName.trim(),
        description: repoDescription.trim(),
        isPrivate: visibility === 'Private',
      })
      toast.success('Repository created and connected.')
      setShowPicker(false)
      refetch()
    } catch (error) {
      toast.error(error.message || 'Could not create repository.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectExisting = async (repo) => {
    setSubmitting(true)
    try {
      await githubApi.connectGithubRepo({ owner: repo.owner, name: repo.name })
      toast.success('Repository connected.')
      setShowPicker(false)
      refetch()
    } catch (error) {
      toast.error(error.message || 'Could not connect that repository.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await githubApi.disconnectGithub()
      toast.success('GitHub disconnected.')
      setShowDisconnectConfirm(false)
      setExistingRepos(null)
      refetch()
    } catch (error) {
      toast.error(error.message || 'Could not disconnect GitHub.')
    } finally {
      setDisconnecting(false)
    }
  }

  const repository = status.repository

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted">
            <Github size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">GitHub repository</p>
            <p className="mt-1 text-xs leading-5 text-faint">
              {status.connected ? `Connected as ${status.githubUsername}` : 'Sync your DSA journal to a repository you control.'}
            </p>
          </div>
        </div>
        {status.connected && <Badge tone="green">Connected</Badge>}
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-faint">
          <LoaderCircle size={14} className="animate-spin" /> Checking connection...
        </div>
      ) : !status.connected ? (
        <Button className="mt-4" onClick={connect} disabled={connecting}>
          {connecting ? <LoaderCircle size={16} className="animate-spin" /> : <Github size={16} />}
          {connecting ? 'Redirecting to GitHub...' : 'Connect GitHub'}
        </Button>
      ) : repository ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-line bg-surface-subtle p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-copy">{repository.fullName}</p>
              <Badge tone={repository.isPrivate ? 'coral' : 'neutral'}>{repository.isPrivate ? 'Private' : 'Public'}</Badge>
            </div>
            {repository.description && <p className="mt-1 text-xs leading-5 text-faint">{repository.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-faint">
              <span className="inline-flex items-center gap-1">
                <GitBranch size={12} /> {repository.defaultBranch}
              </span>
              <a
                href={repository.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center gap-1 text-accent hover:underline"
              >
                View on GitHub <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openPicker('Create new')}>Change repository</Button>
            <Button variant="ghost" onClick={() => setShowDisconnectConfirm(true)}>Disconnect GitHub</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={Plus} onClick={() => openPicker('Create new')}>Create repository</Button>
          <Button variant="secondary" onClick={() => openPicker('Use existing')}>Use existing repository</Button>
          <Button variant="ghost" onClick={() => setShowDisconnectConfirm(true)}>Disconnect GitHub</Button>
        </div>
      )}

      <Modal open={showPicker} onClose={() => !submitting && setShowPicker(false)} labelledBy="github-repo-picker-title">
        <h3 id="github-repo-picker-title" className="font-display text-[15px] font-bold text-ink">Choose a repository</h3>
        <div className="mt-4">
          <SegmentedControl options={MODES} value={mode} onChange={handleModeChange} />
        </div>

        {mode === 'Create new' ? (
          <div className="mt-4 space-y-4">
            <Input label="Repository name" value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder={DEFAULT_REPO_NAME} />
            <Input
              label="Description (optional)"
              value={repoDescription}
              onChange={(event) => setRepoDescription(event.target.value)}
              placeholder="My DSA practice journal"
            />
            <div>
              <span className="mb-2 block text-sm font-semibold text-copy">Visibility</span>
              <SegmentedControl options={['Private', 'Public']} value={visibility} onChange={setVisibility} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create & connect'}
            </Button>
          </div>
        ) : (
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {loadingRepos ? (
              <div className="flex items-center gap-2 py-6 text-sm text-faint">
                <LoaderCircle size={14} className="animate-spin" /> Loading your repositories...
              </div>
            ) : existingRepos && existingRepos.length > 0 ? (
              existingRepos.map((repo) => (
                <RepoRow key={repo.id} repo={repo} onSelect={handleSelectExisting} disabled={submitting} />
              ))
            ) : (
              <p className="py-6 text-center text-sm text-faint">No repositories found on your GitHub account.</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={showDisconnectConfirm}
        title="Disconnect GitHub?"
        description="Momentum will lose access to your repository until you reconnect."
        confirmLabel="Disconnect"
        tone="danger"
        isLoading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
      />
    </Card>
  )
}
