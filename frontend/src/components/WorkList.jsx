import { CheckCircle2, Circle, LoaderCircle, Pencil, SquareCheckBig, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { Badge, Card, IconButton } from './ui'

const PRIORITY_DOT = { LOW: 'bg-faint', MEDIUM: 'bg-yellow', HIGH: 'bg-coral' }

// `selectedIds`/`onToggleSelect` are optional — omitting them (the default,
// e.g. Overview's read-only previews) renders exactly as before.
export default function WorkList({ items = [], onToggleComplete, onDelete, onEdit, selectedIds, onToggleSelect }) {
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

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {items.map((item) => {
        const isPending = pendingId === item.id
        const subtaskCount = item.subtasks?.length || 0
        const isSelected = selectable && selectedIds.has(item.id)

        return (
          <div key={item.id || item.title} className={`group flex min-w-0 flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface-subtle sm:px-5 ${isSelected ? 'bg-accent-soft/40' : ''}`}>
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
                onClick={() => handleToggle(item)}
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
                  onClick={() => setPendingDelete(item)}
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
      })}
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
    </Card>
  )
}
