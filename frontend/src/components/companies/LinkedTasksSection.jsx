import { CheckCircle2, Circle, LoaderCircle, Link2, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { taskApi } from '../../api'
import { useToast } from '../ToastProvider'
import { Button, Card, EmptyState } from '../ui'
import { formatDate, toDateTimeInputValue } from '../../utils/format'

const fieldClass = 'focus-ring h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-copy placeholder:text-faint transition-colors hover:border-line-strong'

function QuickAddTask({ companyId, onCreated }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState(() => toDateTimeInputValue())
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (title.trim().length < 3) return
    setIsSaving(true)
    try {
      const created = await taskApi.createTask({
        title: title.trim(),
        estimatedHours: 1,
        deadline: new Date(deadline).toISOString(),
        companyId,
      })
      onCreated(created)
      setTitle('')
      toast.success('Task created and linked.')
    } catch (error) {
      toast.error(error.message || 'Could not create the task.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input aria-label="New task title" placeholder="e.g. Solve 20 LeetCode problems" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} />
      <input aria-label="Deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={`${fieldClass} sm:w-48`} />
      <Button type="submit" icon={Plus} disabled={isSaving || title.trim().length < 3} className="shrink-0">
        {isSaving && <LoaderCircle className="animate-spin" size={15} />}
        Add
      </Button>
    </form>
  )
}

function LinkExistingPicker({ companyId, allTasks, onLink, onClose }) {
  const [search, setSearch] = useState('')

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allTasks
      .filter((task) => task.companyId !== companyId)
      .filter((task) => !term || task.title.toLowerCase().includes(term))
      .slice(0, 20)
  }, [allTasks, companyId, search])

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <input aria-label="Search your tasks" placeholder="Search your tasks..." value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} autoFocus />
        <button type="button" onClick={onClose} aria-label="Close" className="focus-ring grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><X size={16} /></button>
      </div>
      {candidates.length === 0 ? (
        <p className="py-4 text-center text-sm text-faint">No matching tasks.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {candidates.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onLink(task)}
              className="focus-ring flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-subtle"
            >
              <span className="min-w-0 flex-1 truncate text-copy">{task.title}</span>
              {task.companyId && <span className="shrink-0 text-xs text-faint">linked elsewhere</span>}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// Receives `tasks`/`updateTask`/`refetch` from the parent (CompanyDetail)
// rather than calling useTasks() itself — the parent already needs the full
// task list for the prep-progress calculation, so this avoids a second,
// redundant fetch of the same collection on the same page.
export default function LinkedTasksSection({ companyId, tasks, updateTask, refetch }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [showPicker, setShowPicker] = useState(false)
  const [pendingId, setPendingId] = useState(null)

  const linkedTasks = useMemo(() => tasks.filter((task) => task.companyId === companyId), [tasks, companyId])

  const handleToggleComplete = async (task) => {
    setPendingId(task.id)
    try {
      await updateTask(task.id, { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' })
    } catch (error) {
      toast.error(error.message || 'Could not update the task.')
    } finally {
      setPendingId(null)
    }
  }

  const handleUnlink = async (task) => {
    setPendingId(task.id)
    try {
      await updateTask(task.id, { companyId: null })
      toast.success('Task unlinked.')
    } catch (error) {
      toast.error(error.message || 'Could not unlink the task.')
    } finally {
      setPendingId(null)
    }
  }

  const handleLink = async (task) => {
    setPendingId(task.id)
    try {
      await updateTask(task.id, { companyId })
      setShowPicker(false)
      toast.success('Task linked.')
    } catch (error) {
      toast.error(error.message || 'Could not link the task.')
    } finally {
      setPendingId(null)
    }
  }

  const handleQuickAdded = () => {
    refetch().catch(() => {})
  }

  return (
    <div className="space-y-4">
      {linkedTasks.length === 0 ? (
        <EmptyState compact icon={Link2} title="No prep tasks linked yet" description="Link an existing task or add a new one below to track what's pending." />
      ) : (
        <div className="space-y-1.5">
          {linkedTasks.map((task) => {
            const done = task.status === 'COMPLETED'
            const isPending = pendingId === task.id
            return (
              <div key={task.id} className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleToggleComplete(task)}
                  disabled={isPending}
                  aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
                  className={`focus-ring shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${done ? 'text-accent' : 'text-faint hover:text-accent'}`}
                >
                  {isPending ? <LoaderCircle size={16} className="animate-spin" /> : done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
                <button type="button" onClick={() => navigate('/tasks')} className="min-w-0 flex-1 text-left">
                  <p className={`truncate text-sm font-semibold ${done ? 'text-faint line-through' : 'text-copy'}`}>{task.title}</p>
                  <p className="mt-0.5 text-xs text-faint">Due {formatDate(task.deadline)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleUnlink(task)}
                  disabled={isPending}
                  className="focus-ring hidden shrink-0 rounded p-1.5 text-faint opacity-0 transition-colors hover:text-coral group-hover:block group-hover:opacity-100 disabled:opacity-60"
                  aria-label={`Unlink ${task.title}`}
                >
                  {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showPicker ? (
        <LinkExistingPicker companyId={companyId} allTasks={tasks} onLink={handleLink} onClose={() => setShowPicker(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Link2} onClick={() => setShowPicker(true)}>Link existing task</Button>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <QuickAddTask companyId={companyId} onCreated={handleQuickAdded} />
      </div>
    </div>
  )
}
