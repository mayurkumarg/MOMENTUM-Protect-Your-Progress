import { CheckCircle2, Circle, MoreHorizontal, Trash2 } from 'lucide-react'
import { Badge, Card, IconButton } from './ui'

export default function WorkList({ items = [], onToggleComplete, onDelete }) {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {items.map((item) => (
        <div key={item.id || item.title} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle sm:px-5">
          <button
            aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
            className={`focus-ring rounded-full ${item.completed ? 'text-accent' : 'text-faint hover:text-accent'}`}
            onClick={() => onToggleComplete?.(item)}
            disabled={!onToggleComplete}
          >
            {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold text-copy ${item.completed ? 'line-through opacity-70' : ''}`}>{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-faint">{item.context}</p>
          </div>
          <Badge tone={item.tone}>{item.label}</Badge>
          {onDelete ? (
            <IconButton icon={Trash2} label={`Delete ${item.title}`} className="hidden size-8 opacity-0 group-hover:opacity-100 sm:grid" onClick={() => onDelete(item)} />
          ) : (
            <IconButton icon={MoreHorizontal} label="Task options" className="hidden size-8 opacity-0 group-hover:opacity-100 sm:grid" />
          )}
        </div>
      ))}
    </Card>
  )
}
