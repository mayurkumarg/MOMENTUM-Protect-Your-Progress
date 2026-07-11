import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WorkspaceNotes from '../components/notes/WorkspaceNotes'
import { Button, Card, ErrorState, PageHeader } from '../components/ui'
import { useTasks } from '../hooks/useTasks'
import { formatDate } from '../utils/format'

export default function TaskWorkspace() {
  const { taskId } = useParams()
  const navigate = useNavigate()

  const { tasks, isLoading: isLoadingTasks } = useTasks()
  const task = useMemo(() => tasks.find((item) => item.id === taskId), [tasks, taskId])

  if (!isLoadingTasks && !task) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        <Card><ErrorState title="Task not found" description="This task may have been deleted." action={<Button onClick={() => navigate('/tasks')}>Go to Tasks</Button>} /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" icon={ArrowLeft} className="mb-3 -ml-3" onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        <PageHeader
          eyebrow="Workspace"
          title={task ? task.title : 'Loading…'}
          description={task ? `${task.category ? `${task.category} · ` : ''}Due ${formatDate(task.deadline)}` : undefined}
        />
      </div>

      <WorkspaceNotes
        entityType="TASK"
        entityId={taskId}
        emptyStateDescription="Keep everything related to this task in one place — notes, checklists, code snippets, links, and files."
      />
    </div>
  )
}
