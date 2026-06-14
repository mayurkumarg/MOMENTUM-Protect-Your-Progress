import { Filter, Inbox, LoaderCircle, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import WorkList from '../components/WorkList'
import { Button, Card, EmptyState, ErrorState, IconButton, Input, LoadingState, PageHeader, Section, SegmentedControl } from '../components/ui'
import { useTasks } from '../hooks/useTasks'
import { toDateTimeInputValue } from '../utils/format'
import { mapTaskToWorkItem, splitTasks } from '../utils/tasks'

const emptyTask = {
  title: '',
  category: '',
  estimatedHours: 1,
  deadline: toDateTimeInputValue(),
}

function TaskForm({ onSubmit, isSaving, onCancel }) {
  const [form, setForm] = useState(emptyTask)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    await onSubmit({
      title: form.title.trim(),
      category: form.category.trim() || null,
      estimatedHours: Number(form.estimatedHours),
      deadline: new Date(form.deadline).toISOString(),
    })
    setForm(emptyTask)
  }

  return (
    <Card className="p-5">
      <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_210px_auto]" onSubmit={submit}>
        <Input label="Task" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Finish graph traversal notes" required minLength={3} />
        <Input label="Hours" value={form.estimatedHours} onChange={(event) => updateField('estimatedHours', event.target.value)} type="number" min="0.25" max="100" step="0.25" required />
        <Input label="Deadline" value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} type="datetime-local" required />
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={isSaving || form.title.trim().length < 3}>
            {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : null}
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
        <div className="md:col-span-2">
          <Input label="Category" value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="DSA practice" />
        </div>
      </form>
    </Card>
  )
}

export default function Tasks() {
  const [view, setView] = useState('List')
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { tasks, isLoading, error, refetch, addTask, updateTask, removeTask } = useTasks()

  const mappedTasks = useMemo(() => tasks.map(mapTaskToWorkItem), [tasks])
  const groups = useMemo(() => splitTasks(tasks), [tasks])

  const createTask = async (task) => {
    setIsSaving(true)
    try {
      await addTask(task)
      setShowForm(false)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleComplete = (task) => {
    updateTask(task.id, { status: task.completed ? 'PENDING' : 'COMPLETED' }).catch(() => {})
  }

  const deleteSelectedTask = (task) => {
    removeTask(task.id).catch(() => {})
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Plan" title="Tasks" description="Shape your workload into a plan you can actually follow." actions={<Button icon={Plus} onClick={() => setShowForm(true)}>New task</Button>} />
      {showForm && <TaskForm onSubmit={createTask} isSaving={isSaving} onCancel={() => setShowForm(false)} />}
      {error && (
        <Card><ErrorState title="Tasks could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch(() => {})}>Retry</Button>} /></Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={['List', 'Board']} value={view} onChange={setView} />
        <div className="flex gap-1"><IconButton icon={Search} label="Search tasks" /><IconButton icon={Filter} label="Filter tasks" /></div>
      </div>
      {isLoading ? (
        <Card><LoadingState label="Loading tasks" /></Card>
      ) : view === 'List' ? (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-7">
            <Section title="Today" description="Tasks due before the day ends.">
              {groups.today.length ? <WorkList items={groups.today.map(mapTaskToWorkItem)} onToggleComplete={toggleComplete} onDelete={deleteSelectedTask} /> : <Card><EmptyState compact icon={Inbox} title="Nothing due today" description="Add a task with today's deadline when there is something worth protecting." action={<Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Add task</Button>} /></Card>}
            </Section>
            <Section title="Upcoming">
              {groups.upcoming.length ? <WorkList items={groups.upcoming.map(mapTaskToWorkItem)} onToggleComplete={toggleComplete} onDelete={deleteSelectedTask} /> : <Card><EmptyState compact icon={Inbox} title="Nothing queued yet" description="Tasks with a later date will wait here, out of today's way." action={<Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Add upcoming task</Button>} /></Card>}
            </Section>
          </div>
          <Card className="h-fit p-5">
            <p className="eyebrow">Planning principle</p>
            <p className="mt-4 font-display text-lg font-bold leading-6">Make the next action obvious.</p>
            <p className="mt-2 text-sm leading-5 text-muted">A good task starts with a verb and is small enough to complete in one focused session.</p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Next', groups.upcoming],
            ['In progress', groups.today],
            ['Done', groups.completed],
          ].map(([column, columnTasks]) => (
            <Card key={column} className="min-h-80 p-4">
              <p className="mb-4 text-sm font-semibold">{column}</p>
              {columnTasks.length ? <WorkList items={columnTasks.map(mapTaskToWorkItem)} onToggleComplete={toggleComplete} onDelete={deleteSelectedTask} /> : <EmptyState compact title={`Nothing ${column.toLowerCase()}`} description="Tasks will move here as your work takes shape." />}
            </Card>
          ))}
        </div>
      )}
      {!isLoading && !mappedTasks.length && !error && (
        <Card><EmptyState icon={Inbox} title="No tasks yet" description="Create your first task to start turning intent into a plan." action={<Button icon={Plus} onClick={() => setShowForm(true)}>New task</Button>} /></Card>
      )}
    </div>
  )
}
