import { CheckCircle2, Clock, ExternalLink, Flag, LoaderCircle, NotebookText, Tag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal'
import { Badge, Button } from '../ui'
import { useToast } from '../ToastProvider'
import { formatActivityDuration, formatDateTime } from '../../utils/format'
import { describeReminder, STATUS_OPTIONS } from '../../utils/tasks'

const statusLabel = (value) => STATUS_OPTIONS.find((option) => option.value === value)?.label || value

// Compact popup (reuses the app's small Modal, not a page) — click-through
// destination for every event chip across Month/Week/Day. Deliberately has no
// edit-deadline or create-task action: task editing stays on the Tasks page.
export default function EventDetailModal({ event, onClose, onUpdateTask }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  if (!event) return null

  const isTask = event.source === 'TASK'
  const task = isTask ? event.raw : null
  const activity = !isTask ? event.raw : null
  const reminderLabel = isTask ? describeReminder(task.reminder) : null
  const duration = activity ? formatActivityDuration(activity) : null

  const handleToggleComplete = async () => {
    setIsSaving(true)
    try {
      const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
      await onUpdateTask(task.id, { status: nextStatus })
      toast.success(nextStatus === 'COMPLETED' ? 'Task marked complete.' : 'Task reopened.')
      onClose()
    } catch (error) {
      toast.error(error.message || 'Could not update the task.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="event-detail-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="event-detail-title" className="min-w-0 flex-1 font-display text-[15px] font-bold leading-snug text-ink">{event.title}</h2>
        <Badge tone={event.tone}>{isTask ? statusLabel(task.status) : 'Activity'}</Badge>
      </div>

      <div className="mt-4 space-y-2.5 text-sm text-copy">
        <div className="flex items-center gap-2">
          <Clock size={14} className="shrink-0 text-faint" />
          <span>{isTask ? `Due ${formatDateTime(task.deadline)}` : formatDateTime(activity.activityDate)}</span>
          {event.isOverdue && <span className="text-xs font-semibold text-coral">· Overdue</span>}
        </div>
        {isTask && task.category && (
          <div className="flex items-center gap-2"><Tag size={14} className="shrink-0 text-faint" />{task.category}</div>
        )}
        {isTask && task.subtasks?.length > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-faint" />
            {task.subtasks.filter((subtask) => subtask.isCompleted).length} of {task.subtasks.length} subtasks done
          </div>
        )}
        {reminderLabel && (
          <div className="flex items-center gap-2"><Flag size={14} className="shrink-0 text-faint" />Reminder: {reminderLabel}</div>
        )}
        {activity && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-faint" />
            {duration.label}{duration.isEstimated ? ' (est.)' : ''}{event.meta.platform ? ` · ${event.meta.platform}` : ''}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {isTask ? (
          <>
            <Button variant="secondary" icon={NotebookText} onClick={() => navigate(`/tasks/${task.id}/workspace`)}>Workspace</Button>
            <Button onClick={handleToggleComplete} disabled={isSaving}>
              {isSaving && <LoaderCircle className="animate-spin" size={15} />}
              {task.status === 'COMPLETED' ? 'Reopen' : 'Mark complete'}
            </Button>
          </>
        ) : (
          <Button icon={ExternalLink} onClick={() => navigate('/activity')}>View in Activity</Button>
        )}
      </div>
    </Modal>
  )
}
