import { CheckCircle2, Circle, LoaderCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { Badge, Card, IconButton } from './ui'

export default function WorkList({ items = [], onToggleComplete, onDelete }) {
  const [pendingId, setPendingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

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
        return (
          <div key={item.id || item.title} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle sm:px-5">
            <button
              aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
              className={`focus-ring rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${item.completed ? 'text-accent' : 'text-faint hover:text-accent'}`}
              onClick={() => handleToggle(item)}
              disabled={!onToggleComplete || isPending}
            >
              {isPending ? <LoaderCircle className="animate-spin" size={18} /> : item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold text-copy ${item.completed ? 'line-through opacity-70' : ''}`}>{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-faint">{item.context}</p>
            </div>
            <Badge tone={item.tone}>{item.label}</Badge>
            {onDelete && (
              <IconButton
                icon={Trash2}
                label={`Delete ${item.title}`}
                className="hidden size-8 opacity-0 group-hover:opacity-100 sm:grid disabled:pointer-events-none disabled:opacity-60"
                onClick={() => setPendingDelete(item)}
                disabled={isPending}
              />
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
