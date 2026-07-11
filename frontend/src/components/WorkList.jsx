import { CheckCircle2, Circle, LoaderCircle, NotebookText, Pencil, SquareCheckBig, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { Badge, Card, IconButton } from './ui'
import { PRIORITY_DOT } from '../utils/tasks'

function TaskRow({ item, isPending, isSelected, selectable, onToggleSelect, onToggleComplete, onEdit, onDelete, onOpenWorkspace, onHandleToggle, onRequestDelete }) {
  const subtaskCount = item.subtasks?.length || 0

  return (
    <div className={`group flex min-w-0 flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface-subtle sm:px-5 ${isSelected ? 'bg-accent-soft/40' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        {selectable && (
          <button
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.title}`}
            onClick={() => onToggleSelect(item.id)}
            className={`focus-ring grid size-5 shrink-0 place-items-center rounded border transition-colors ${isSelected ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent hover:border-accent'}`}
          >
            <SquareCheckBig size={12} />
          </button>
        )}
        <button
          aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
          className={`focus-ring shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${item.completed ? 'text-accent' : 'text-faint hover:text-accent'}`}
          onClick={() => onHandleToggle(item)}
          disabled={!onToggleComplete || isPending}
        >
          {isPending ? <LoaderCircle className="animate-spin" size={18} /> : item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.priority && (
              <span
                title={`Priority: ${item.priority === 'HIGH' ? 'High' : item.priority === 'LOW' ? 'Low' : 'Medium'}`}
                className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || PRIORITY_DOT.MEDIUM}`}
              />
            )}
            <p className={`truncate text-sm font-semibold text-copy ${item.completed ? 'line-through opacity-70' : ''}`}>{item.title}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-faint">
            {item.context}
            {subtaskCount > 0 && ` · ${item.subtasks.filter((s) => s.isCompleted).length}/${subtaskCount} subtasks`}
          </p>
        </div>
        <Badge tone={item.tone}>{item.label}</Badge>
        {onOpenWorkspace && (
          <IconButton
            icon={NotebookText}
            label={`Open workspace for ${item.title}`}
            className="hidden size-8 shrink-0 opacity-0 group-hover:opacity-100 sm:grid disabled:pointer-events-none disabled:opacity-60"
            onClick={() => onOpenWorkspace(item)}
            disabled={isPending}
          />
        )}
        {onEdit && (
          <IconButton
            icon={Pencil}
            label={`Edit ${item.title}`}
            className="hidden size-8 shrink-0 opacity-0 group-hover:opacity-100 sm:grid disabled:pointer-events-none disabled:opacity-60"
            onClick={() => onEdit(item)}
            disabled={isPending}
          />
        )}
        {onDelete && (
          <IconButton
            icon={Trash2}
            label={`Delete ${item.title}`}
            className="hidden size-8 shrink-0 opacity-0 group-hover:opacity-100 sm:grid disabled:pointer-events-none disabled:opacity-60"
            onClick={() => onRequestDelete(item)}
            disabled={isPending}
          />
        )}
      </div>
      {subtaskCount > 0 && (
        <div className="ml-8 h-1 max-w-xs overflow-hidden rounded-full bg-surface-subtle">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${(item.progress || 0) * 100}%` }} />
        </div>
      )}
      {item.tags?.length > 0 && (
        <div className="ml-8 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
        </div>
      )}
    </div>
  )
}

// A vertical card for Kanban columns — narrow (~1/3 page width), so the row
// layout's horizontal space (checkbox, badge, three hover icons all competing
// on one line) is what was truncating titles there. Titles wrap instead of
// single-line-truncating, and actions move to their own row instead of
// stealing width from the title.
function TaskBoardCard({ item, isPending, isSelected, selectable, onToggleSelect, onToggleComplete, onEdit, onDelete, onOpenWorkspace, onHandleToggle, onRequestDelete }) {
  const subtaskCount = item.subtasks?.length || 0
  const hasActions = Boolean(onOpenWorkspace || onEdit || onDelete)

  return (
    <Card hover className={`group p-3.5 ${isSelected ? 'bg-accent-soft/40' : ''}`}>
      <div className="flex items-start gap-2.5">
        {selectable && (
          <button
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.title}`}
            onClick={() => onToggleSelect(item.id)}
            className={`focus-ring mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors ${isSelected ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent hover:border-accent'}`}
          >
            <SquareCheckBig size={12} />
          </button>
        )}
        <button
          aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
          className={`focus-ring mt-0.5 shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${item.completed ? 'text-accent' : 'text-faint hover:text-accent'}`}
          onClick={() => onHandleToggle(item)}
          disabled={!onToggleComplete || isPending}
        >
          {isPending ? <LoaderCircle className="animate-spin" size={18} /> : item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {item.priority && (
              <span
                title={`Priority: ${item.priority === 'HIGH' ? 'High' : item.priority === 'LOW' ? 'Low' : 'Medium'}`}
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || PRIORITY_DOT.MEDIUM}`}
              />
            )}
            <p className={`min-w-0 break-words text-sm font-semibold leading-snug text-copy ${item.completed ? 'line-through opacity-70' : ''}`}>{item.title}</p>
          </div>
          <p className="mt-1 truncate text-xs text-faint">{item.context}</p>
        </div>
      </div>

      {subtaskCount > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-subtle">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${(item.progress || 0) * 100}%` }} />
          </div>
          <span className="shrink-0 text-[10px] font-medium text-faint">{item.subtasks.filter((s) => s.isCompleted).length}/{subtaskCount}</span>
        </div>
      )}

      {item.tags?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <Badge tone={item.tone}>{item.label}</Badge>
        {hasActions && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onOpenWorkspace && <IconButton icon={NotebookText} label={`Open workspace for ${item.title}`} className="size-8 shrink-0 disabled:pointer-events-none disabled:opacity-60" onClick={() => onOpenWorkspace(item)} disabled={isPending} />}
            {onEdit && <IconButton icon={Pencil} label={`Edit ${item.title}`} className="size-8 shrink-0 disabled:pointer-events-none disabled:opacity-60" onClick={() => onEdit(item)} disabled={isPending} />}
            {onDelete && <IconButton icon={Trash2} label={`Delete ${item.title}`} className="size-8 shrink-0 disabled:pointer-events-none disabled:opacity-60" onClick={() => onRequestDelete(item)} disabled={isPending} />}
          </div>
        )}
      </div>
    </Card>
  )
}

// `selectedIds`/`onToggleSelect` are optional — omitting them (the default,
// e.g. Overview's read-only previews) renders exactly as before.
// `variant="row"` (default) is the original divided-list layout, unchanged.
// `variant="board"` renders each item as its own card with a wrapping title
// — used by the Kanban board, where columns are too narrow for the row layout.
export default function WorkList({ items = [], variant = 'row', onToggleComplete, onDelete, onEdit, onOpenWorkspace, selectedIds, onToggleSelect }) {
  const [pendingId, setPendingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const selectable = Boolean(selectedIds && onToggleSelect)

  const handleToggle = async (item) => {
    if (!onToggleComplete || pendingId) return
    setPendingId(item.id)
    try {
      await onToggleComplete(item)
    } catch {
      // caller is responsible for surfacing the error (e.g. via toast)
    } finally {
      setPendingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setPendingId(pendingDelete.id)
    try {
      await onDelete(pendingDelete)
    } catch {
      // caller is responsible for surfacing the error (e.g. via toast)
    } finally {
      setPendingId(null)
      setPendingDelete(null)
    }
  }

  const itemProps = (item) => ({
    item,
    isPending: pendingId === item.id,
    isSelected: selectable && selectedIds.has(item.id),
    selectable,
    onToggleSelect,
    onToggleComplete,
    onEdit,
    onDelete,
    onOpenWorkspace,
    onHandleToggle: handleToggle,
    onRequestDelete: setPendingDelete,
  })

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(pendingDelete)}
      title={`Delete "${pendingDelete?.title || ''}"?`}
      description="This can't be undone."
      confirmLabel="Delete"
      tone="danger"
      isLoading={pendingId === pendingDelete?.id}
      onConfirm={handleConfirmDelete}
      onCancel={() => setPendingDelete(null)}
    />
  )

  if (variant === 'board') {
    return (
      <div className="space-y-2.5">
        {items.map((item) => <TaskBoardCard key={item.id || item.title} {...itemProps(item)} />)}
        {confirmDialog}
      </div>
    )
  }

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {items.map((item) => <TaskRow key={item.id || item.title} {...itemProps(item)} />)}
      {confirmDialog}
    </Card>
  )
}
