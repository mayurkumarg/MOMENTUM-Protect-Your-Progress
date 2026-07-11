import { CheckSquare2, Filter, Inbox, ListChecks, LoaderCircle, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import SubtaskChecklist from '../components/SubtaskChecklist'
import TagInput from '../components/TagInput'
import WorkList from '../components/WorkList'
import { useToast } from '../components/ToastProvider'
import { Button, Card, EmptyState, ErrorState, IconButton, Input, LoadingState, PageHeader, Section, SegmentedControl } from '../components/ui'
import { useTasks } from '../hooks/useTasks'
import { formatDayLabel, toDateTimeInputValue } from '../utils/format'
import {
  DEFAULT_TASK_FILTERS,
  GROUP_OPTIONS,
  PRIORITY_DOT,
  PRIORITY_OPTIONS,
  REMINDER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  applyTaskFilters,
  buildReminderPayload,
  groupTasksBy,
  hasActiveTaskFilters,
  mapTaskToWorkItem,
  reminderToFormValue,
  sortTasks,
  splitTasks,
} from '../utils/tasks'

const PRIORITY_LABELS = PRIORITY_OPTIONS.map((option) => option.label)
const STATUS_LABELS = STATUS_OPTIONS.map((option) => option.label)

const priorityValueToLabel = (value) => PRIORITY_OPTIONS.find((option) => option.value === value)?.label || 'Medium'
const priorityLabelToValue = (label) => PRIORITY_OPTIONS.find((option) => option.label === label)?.value || 'MEDIUM'
const statusValueToLabel = (value) => STATUS_OPTIONS.find((option) => option.value === value)?.label || 'Pending'
const statusLabelToValue = (label) => STATUS_OPTIONS.find((option) => option.label === label)?.value || 'PENDING'

// Requesting Notification permission here (not on page load) ties the
// browser prompt to a direct user action — enabling a reminder — which is
// both good practice and far more likely to be granted than an ambient ask.
const requestNotificationPermission = () => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

function ReminderFields({ reminderOffset, setReminderOffset, customReminderAt, setCustomReminderAt, deadline }) {
  const handleReminderChange = (value) => {
    setReminderOffset(value)
    if (value) requestNotificationPermission()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-copy">Reminder</span>
        <select
          value={reminderOffset}
          onChange={(event) => handleReminderChange(event.target.value)}
          className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy"
        >
          <option value="">No reminder</option>
          {REMINDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {reminderOffset === 'custom' && (
        <Input
          label="Remind me at"
          type="datetime-local"
          value={customReminderAt}
          onChange={(event) => setCustomReminderAt(event.target.value)}
          max={deadline}
          required
        />
      )}
    </div>
  )
}

const emptyTask = {
  title: '',
  category: '',
  estimatedHours: 1,
  deadline: toDateTimeInputValue(),
  priority: 'Medium',
}

function TaskForm({ onSubmit, isSaving, onCancel }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyTask)
  const [tags, setTags] = useState([])
  const [reminderOffset, setReminderOffset] = useState('')
  const [customReminderAt, setCustomReminderAt] = useState('')
  const [addNoteAfterCreate, setAddNoteAfterCreate] = useState(false)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    const created = await onSubmit({
      title: form.title.trim(),
      category: form.category.trim() || null,
      estimatedHours: Number(form.estimatedHours),
      deadline: new Date(form.deadline).toISOString(),
      priority: priorityLabelToValue(form.priority),
      tags,
      reminder: buildReminderPayload(reminderOffset, customReminderAt),
    })
    if (created) {
      setForm(emptyTask)
      setTags([])
      setReminderOffset('')
      setCustomReminderAt('')
      if (addNoteAfterCreate) navigate(`/tasks/${created.id}/workspace`)
      setAddNoteAfterCreate(false)
    }
  }

  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
          <Input label="Task" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Finish graph traversal notes" required minLength={3} />
          <Input label="Category / commitment (optional)" value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="DSA, Academics, Internship..." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Hours" value={form.estimatedHours} onChange={(event) => updateField('estimatedHours', event.target.value)} type="number" min="0.25" max="100" step="0.25" required />
          <Input label="Deadline" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} type="datetime-local" required />
          <div>
            <span className="mb-2 block text-sm font-semibold text-copy">Priority</span>
            <SegmentedControl options={PRIORITY_LABELS} value={form.priority} onChange={(value) => updateField('priority', value)} />
          </div>
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="e.g. leetcode, urgent, review" />
        <ReminderFields
          reminderOffset={reminderOffset}
          setReminderOffset={setReminderOffset}
          customReminderAt={customReminderAt}
          setCustomReminderAt={setCustomReminderAt}
          deadline={form.deadline}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={addNoteAfterCreate}
              onChange={(event) => setAddNoteAfterCreate(event.target.checked)}
              className="focus-ring size-4 rounded border-line-strong accent-accent"
            />
            Add a note after creating
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isSaving || form.title.trim().length < 3}>
              {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : null}
              Add task
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

function EditTaskModal({ task, onClose, onSubmit, isSaving }) {
  const [form, setForm] = useState(() => ({
    title: task.title,
    category: task.category || '',
    estimatedHours: task.estimatedHours,
    deadline: toDateTimeInputValue(task.deadline),
    priority: priorityValueToLabel(task.priority),
    status: statusValueToLabel(task.status),
  }))
  const [tags, setTags] = useState(() => task.tags || [])
  const [subtasks, setSubtasks] = useState(() => task.subtasks || [])
  const [reminderOffset, setReminderOffset] = useState(() => reminderToFormValue(task.reminder))
  const [customReminderAt, setCustomReminderAt] = useState(() => (task.reminder?.isCustom ? toDateTimeInputValue(task.reminder.remindAt) : ''))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    await onSubmit(task.id, {
      title: form.title.trim(),
      category: form.category.trim() || null,
      estimatedHours: Number(form.estimatedHours),
      deadline: new Date(form.deadline).toISOString(),
      priority: priorityLabelToValue(form.priority),
      status: statusLabelToValue(form.status),
      tags,
      subtasks,
      reminder: buildReminderPayload(reminderOffset, customReminderAt),
    })
  }

  return (
    <Modal open onClose={onClose} labelledBy="edit-task-title">
      <h2 id="edit-task-title" className="font-display text-[15px] font-bold text-ink">Edit task</h2>
      <form className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1" onSubmit={submit}>
        <Input label="Task" value={form.title} onChange={(event) => updateField('title', event.target.value)} required minLength={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Hours" value={form.estimatedHours} onChange={(event) => updateField('estimatedHours', event.target.value)} type="number" min="0.25" max="100" step="0.25" required />
          <Input label="Category / commitment (optional)" value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="DSA, Academics, Internship..." />
        </div>
        <Input label="Deadline" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} type="datetime-local" required />
        <div>
          <span className="mb-2 block text-sm font-semibold text-copy">Status</span>
          <SegmentedControl options={STATUS_LABELS} value={form.status} onChange={(value) => updateField('status', value)} />
        </div>
        <div>
          <span className="mb-2 block text-sm font-semibold text-copy">Priority</span>
          <SegmentedControl options={PRIORITY_LABELS} value={form.priority} onChange={(value) => updateField('priority', value)} />
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="e.g. leetcode, urgent, review" />
        <div className="rounded-md border border-line p-3.5">
          <SubtaskChecklist subtasks={subtasks} onChange={setSubtasks} />
        </div>
        <ReminderFields
          reminderOffset={reminderOffset}
          setReminderOffset={setReminderOffset}
          customReminderAt={customReminderAt}
          setCustomReminderAt={setCustomReminderAt}
          deadline={form.deadline}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || form.title.trim().length < 3}>
            {isSaving && <LoaderCircle className="animate-spin" size={15} />}
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

const STATUS_DOT = { PENDING: 'bg-faint', IN_PROGRESS: 'bg-yellow', COMPLETED: 'bg-accent' }

const TIMEFRAME_OPTIONS = ['All', 'Today', 'This week', 'Overdue']
const TIMEFRAME_TO_VALUE = { All: 'all', Today: 'today', 'This week': 'week', Overdue: 'overdue' }
const VALUE_TO_TIMEFRAME = { all: 'All', today: 'Today', week: 'This week', overdue: 'Overdue' }

function TaskFilterBar({ filters, onChange, categories, tags }) {
  const toggleListValue = (key, value) => {
    const current = filters[key]
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={TIMEFRAME_OPTIONS}
          value={VALUE_TO_TIMEFRAME[filters.timeframe]}
          onChange={(label) => onChange({ ...filters, timeframe: TIMEFRAME_TO_VALUE[label] })}
        />
        {hasActiveTaskFilters(filters) && (
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange(DEFAULT_TASK_FILTERS)}>Clear filters</Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-faint">Status</span>
        {STATUS_OPTIONS.map((option) => (
          <FilterChip key={option.value} active={filters.statuses.includes(option.value)} onClick={() => toggleListValue('statuses', option.value)}>
            {option.label}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-faint">Priority</span>
        {PRIORITY_OPTIONS.map((option) => (
          <FilterChip key={option.value} active={filters.priorities.includes(option.value)} onClick={() => toggleListValue('priorities', option.value)}>
            {option.label}
          </FilterChip>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-faint">Tags</span>
          {tags.map((tag) => (
            <FilterChip key={tag} active={filters.tags.includes(tag)} onClick={() => toggleListValue('tags', tag)}>
              {tag}
            </FilterChip>
          ))}
        </div>
      )}
      {categories.length > 0 && (
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-faint">Category</span>
          <select
            value={filters.category}
            onChange={(event) => onChange({ ...filters, category: event.target.value })}
            className="focus-ring h-8 rounded-md border border-line bg-surface px-2 text-xs font-medium text-copy"
          >
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      )}
    </Card>
  )
}

export default function Tasks() {
  const navigate = useNavigate()
  const [view, setView] = useState('List')
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS)
  const [sortBy, setSortBy] = useState('deadline')
  const [groupBy, setGroupBy] = useState('none')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const toast = useToast()
  const { tasks, isLoading, error, refetch, addTask, updateTask, removeTask } = useTasks()

  const categories = useMemo(
    () => [...new Set(tasks.map((task) => task.category).filter(Boolean))].sort(),
    [tasks]
  )
  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags || []))].sort(),
    [tasks]
  )

  const searchedTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => task.title.toLowerCase().includes(term) || (task.tags || []).some((tag) => tag.includes(term)))
  }, [tasks, searchTerm])

  const filteredTasks = useMemo(() => applyTaskFilters(searchedTasks, filters), [searchedTasks, filters])
  const sortedTasks = useMemo(() => sortTasks(filteredTasks, sortBy), [filteredTasks, sortBy])
  const customGroups = useMemo(() => groupTasksBy(sortedTasks, groupBy), [sortedTasks, groupBy])

  const filtersActive = hasActiveTaskFilters(filters)
  const mappedTasks = useMemo(() => sortedTasks.map(mapTaskToWorkItem), [sortedTasks])
  const groups = useMemo(() => splitTasks(sortedTasks), [sortedTasks])
  const statusGroups = useMemo(() => ([
    { key: 'PENDING', label: 'Pending', tasks: sortedTasks.filter((task) => task.status === 'PENDING') },
    { key: 'IN_PROGRESS', label: 'In Progress', tasks: sortedTasks.filter((task) => task.status === 'IN_PROGRESS') },
    { key: 'COMPLETED', label: 'Completed', tasks: sortedTasks.filter((task) => task.status === 'COMPLETED') },
  ]), [sortedTasks])

  // Sidebar snapshot — deliberately computed from the full, unfiltered task
  // list (not sortedTasks) so an active search/filter never makes these
  // numbers look misleadingly low (e.g. "0% done" just because completed
  // tasks happen to be filtered out right now).
  const snapshot = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const completed = tasks.filter((task) => task.status === 'COMPLETED')
    const completedThisWeek = completed.filter((task) => task.completedAt && new Date(task.completedAt) >= sevenDaysAgo).length
    const completionRate = tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100)
    const upcoming = tasks
      .filter((task) => task.status !== 'COMPLETED' && task.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 4)

    return { active: tasks.length - completed.length, completedThisWeek, completionRate, upcoming }
  }, [tasks])

  const createTask = async (task) => {
    setIsSaving(true)
    try {
      const created = await addTask(task)
      setShowForm(false)
      toast.success('Task created.')
      return created
    } catch (error) {
      toast.error(error.message || 'Could not create task.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const saveEditedTask = async (id, updates) => {
    setIsEditSaving(true)
    try {
      await updateTask(id, updates)
      setEditingTask(null)
      toast.success('Task updated.')
    } catch (error) {
      toast.error(error.message || 'Could not update task.')
    } finally {
      setIsEditSaving(false)
    }
  }

  const toggleComplete = (task) =>
    updateTask(task.id, { status: task.completed ? 'PENDING' : 'COMPLETED' }).catch((error) => {
      toast.error(error.message || 'Could not update task.')
    })

  const deleteSelectedTask = (task) =>
    removeTask(task.id)
      .then(() => toast.success('Task deleted.'))
      .catch((error) => {
        toast.error(error.message || 'Could not delete task.')
      })

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchTerm('')
  }

  const toggleSelectMode = () => {
    setSelectMode((current) => !current)
    setSelectedIds(new Set())
  }

  const toggleSelectId = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Promise.allSettled (not Promise.all) so one failing item doesn't block the
  // rest of the batch — partial success is reported accurately, and only the
  // items that actually succeeded are cleared from selection, so failed items
  // stay selected and visible for the user to retry.
  const bulkComplete = async () => {
    setBulkBusy(true)
    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => updateTask(id, { status: 'COMPLETED' })))
    const succeededIds = ids.filter((_, index) => results[index].status === 'fulfilled')
    const failedCount = ids.length - succeededIds.length

    if (succeededIds.length > 0) {
      toast.success(`${succeededIds.length} of ${ids.length} task${ids.length === 1 ? '' : 's'} marked complete.`)
    }
    if (failedCount > 0) {
      toast.error(`Could not update ${failedCount} task${failedCount === 1 ? '' : 's'}. They remain selected.`)
    }

    setSelectedIds((current) => {
      const next = new Set(current)
      succeededIds.forEach((id) => next.delete(id))
      return next
    })
    if (failedCount === 0) setSelectMode(false)
    setBulkBusy(false)
  }

  const bulkDelete = async () => {
    setBulkBusy(true)
    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => removeTask(id)))
    const succeededIds = ids.filter((_, index) => results[index].status === 'fulfilled')
    const failedCount = ids.length - succeededIds.length

    if (succeededIds.length > 0) {
      toast.success(`${succeededIds.length} of ${ids.length} task${ids.length === 1 ? '' : 's'} deleted.`)
    }
    if (failedCount > 0) {
      toast.error(`Could not delete ${failedCount} task${failedCount === 1 ? '' : 's'}. They remain selected.`)
    }

    setSelectedIds((current) => {
      const next = new Set(current)
      succeededIds.forEach((id) => next.delete(id))
      return next
    })
    if (failedCount === 0) setSelectMode(false)
    setBulkBusy(false)
    setConfirmBulkDelete(false)
  }

  const openWorkspace = (task) => navigate(`/tasks/${task.id}/workspace`)

  const workListProps = selectMode
    ? { onDelete: deleteSelectedTask, onEdit: setEditingTask, onOpenWorkspace: openWorkspace, selectedIds, onToggleSelect: toggleSelectId }
    : { onToggleComplete: toggleComplete, onDelete: deleteSelectedTask, onEdit: setEditingTask, onOpenWorkspace: openWorkspace }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Plan" title="Tasks" description="Organize DSA practice, academics, projects, and everything else in one place." actions={<Button icon={Plus} onClick={() => setShowForm(true)}>New task</Button>} />
      {showForm && <TaskForm onSubmit={createTask} isSaving={isSaving} onCancel={() => setShowForm(false)} />}
      {error && (
        <Card><ErrorState title="Tasks could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>} /></Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={['List', 'Board']} value={view} onChange={setView} />
        <div className="flex flex-wrap items-center gap-2">
          {view === 'List' && (
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
              aria-label="Group by"
              className="focus-ring h-9 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-copy"
            >
              {GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>Group: {option.label}</option>)}
            </select>
          )}
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label="Sort by"
            className="focus-ring h-9 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-copy"
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>Sort: {option.label}</option>)}
          </select>
          <IconButton icon={Search} label="Search tasks" onClick={() => setSearchOpen((open) => !open)} className={searchOpen ? 'bg-surface-subtle text-ink' : ''} />
          <IconButton icon={Filter} label="Filter tasks" onClick={() => setFilterOpen((open) => !open)} className={filterOpen || filtersActive ? 'bg-surface-subtle text-ink' : ''} />
          <IconButton icon={ListChecks} label="Select tasks" onClick={toggleSelectMode} className={selectMode ? 'bg-surface-subtle text-ink' : ''} />
        </div>
      </div>
      {searchOpen && (
        <div className="flex items-center gap-2">
          <div className="flex-1"><Input label="Search tasks" placeholder="Search by title or tag" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} autoFocus /></div>
          <IconButton icon={X} label="Close search" onClick={closeSearch} />
        </div>
      )}
      {filterOpen && <TaskFilterBar filters={filters} onChange={setFilters} categories={categories} tags={allTags} />}
      {selectMode && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="text-sm font-semibold text-copy">{selectedIds.size} selected</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!selectedIds.size || bulkBusy} onClick={bulkComplete}>
              {bulkBusy ? <LoaderCircle className="animate-spin" size={14} /> : <CheckSquare2 size={14} />} Mark complete
            </Button>
            <Button variant="danger" className="h-8 px-3 text-xs" disabled={!selectedIds.size || bulkBusy} onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 size={14} /> Delete
            </Button>
            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={toggleSelectMode}>Cancel</Button>
          </div>
        </Card>
      )}
      {isLoading ? (
        <Card><LoadingState label="Loading tasks" /></Card>
      ) : view === 'List' ? (
        customGroups ? (
          <div className="space-y-7">
            {customGroups.map((group) => (
              <Section key={group.key} title={group.label} description={`${group.tasks.length} task${group.tasks.length === 1 ? '' : 's'}`}>
                {group.tasks.length ? <WorkList items={group.tasks.map(mapTaskToWorkItem)} {...workListProps} /> : <Card><EmptyState compact icon={Inbox} title="No tasks in this group" description="Tasks will appear here once they match this grouping." /></Card>}
              </Section>
            ))}
          </div>
        ) : (
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-7">
              {groups.overdue.length > 0 && (
                <Section title="Overdue" description="Past their deadline and still pending.">
                  <WorkList items={groups.overdue.map(mapTaskToWorkItem)} {...workListProps} />
                </Section>
              )}
              <Section title="Today" description="Tasks due before the day ends.">
                {groups.today.length ? <WorkList items={groups.today.map(mapTaskToWorkItem)} {...workListProps} /> : <Card><EmptyState compact icon={Inbox} title="Nothing due today" description="Add a task with today's deadline when there is something worth protecting." action={<Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Add task</Button>} /></Card>}
              </Section>
              <Section title="Upcoming">
                {groups.upcoming.length ? <WorkList items={groups.upcoming.map(mapTaskToWorkItem)} {...workListProps} /> : <Card><EmptyState compact icon={Inbox} title="Nothing queued yet" description="Tasks with a later date will wait here, out of today's way." action={<Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Add upcoming task</Button>} /></Card>}
              </Section>
              {groups.completed.length > 0 && (
                <Section title="Completed">
                  <WorkList items={groups.completed.map(mapTaskToWorkItem)} {...workListProps} />
                </Section>
              )}
            </div>
            <div className="space-y-5">
              <Card className="p-5">
                <p className="eyebrow">Snapshot</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="font-display text-5xl font-extrabold leading-none text-ink">{snapshot.completionRate}%</span>
                  <span className="pb-1 text-sm leading-5 text-muted">all-time<br />completion</span>
                </div>
                <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${snapshot.completionRate}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-center">
                  <div>
                    <p className="font-display text-lg font-bold text-ink">{snapshot.active}</p>
                    <p className="text-[11px] text-faint">Active tasks</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-ink">{snapshot.completedThisWeek}</p>
                    <p className="text-[11px] text-faint">Done this week</p>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-line px-4 py-3.5">
                  <p className="font-display text-[15px] font-bold text-ink">Coming up</p>
                </div>
                {snapshot.upcoming.length ? (
                  <div className="divide-y divide-line">
                    {snapshot.upcoming.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setEditingTask(task)}
                        className="focus-ring flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-subtle"
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.MEDIUM}`} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-copy">{task.title}</span>
                        <span className="shrink-0 text-xs text-faint">{formatDayLabel(task.deadline)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted">Nothing else queued.</p>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-3 grid size-9 place-items-center rounded-md bg-accent-soft text-accent"><Sparkles size={16} /></div>
                <p className="eyebrow">Planning principle</p>
                <p className="mt-3 font-display text-lg font-bold leading-6">Make the next action obvious.</p>
                <p className="mt-2 text-sm leading-5 text-muted">A good task starts with a verb and is small enough to complete in one focused session.</p>
              </Card>
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {statusGroups.map((column) => (
            <div key={column.key} className="flex min-h-80 flex-col rounded-xl border border-line bg-surface-subtle/60 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[column.key]}`} />
                <p className="text-sm font-semibold text-copy">{column.label}</p>
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-faint">{column.tasks.length}</span>
              </div>
              {column.tasks.length ? (
                <WorkList variant="board" items={column.tasks.map(mapTaskToWorkItem)} {...workListProps} />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState compact title={`Nothing ${column.label.toLowerCase()}`} description="Tasks will move here as your work takes shape." />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!isLoading && !mappedTasks.length && !error && (
        searchTerm.trim() ? (
          <Card><EmptyState icon={Search} title="No matching tasks" description={`Nothing matches "${searchTerm.trim()}".`} action={<Button variant="secondary" onClick={closeSearch}>Clear search</Button>} /></Card>
        ) : filtersActive ? (
          <Card><EmptyState icon={Filter} title="No tasks match your filters" description="Try widening your filters to see more of your workload." action={<Button variant="secondary" onClick={() => setFilters(DEFAULT_TASK_FILTERS)}>Clear filters</Button>} /></Card>
        ) : (
          <Card><EmptyState icon={Inbox} title="No tasks yet" description="Create your first task to start turning intent into a plan." action={<Button icon={Plus} onClick={() => setShowForm(true)}>New task</Button>} /></Card>
        )
      )}
      {editingTask && (
        <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSubmit={saveEditedTask} isSaving={isEditSaving} />
      )}
      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        isLoading={bulkBusy}
        onConfirm={bulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  )
}
