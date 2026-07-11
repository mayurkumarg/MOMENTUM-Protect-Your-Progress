import { AlertTriangle, CheckCircle2, Circle, Code2 } from 'lucide-react'
import { formatTime } from '../../utils/format'

const TONE_DOT = { neutral: 'bg-faint', green: 'bg-accent', coral: 'bg-coral', yellow: 'bg-yellow' }
const TONE_TEXT = { neutral: 'text-muted', green: 'text-accent', coral: 'text-coral', yellow: 'text-yellow' }

function EventIcon({ event }) {
  if (event.source === 'ACTIVITY') return <Code2 size={12} />
  if (event.status === 'COMPLETED') return <CheckCircle2 size={12} />
  if (event.isOverdue) return <AlertTriangle size={12} />
  return <Circle size={12} />
}

// Shared across Month/Week/Day: `chip` is the compact dot+title pill used in
// dense Month cells, `row` is the richer time+icon+title row used in Week
// columns and the Day agenda where there's room to show more.
export default function EventChip({ event, onSelect, variant = 'chip' }) {
  const isDone = event.source === 'TASK' && event.status === 'COMPLETED'

  const handleClick = (clickEvent) => {
    clickEvent.stopPropagation()
    onSelect(event)
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="focus-ring flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle"
      >
        <span className={`grid size-6 shrink-0 place-items-center rounded-md bg-surface-subtle ${TONE_TEXT[event.tone] || TONE_TEXT.neutral}`}>
          <EventIcon event={event} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isDone ? 'text-faint line-through' : 'text-copy'}`}>{event.title}</p>
          <p className="mt-0.5 truncate text-xs text-faint">
            {formatTime(event.date)}
            {event.meta?.category ? ` · ${event.meta.category}` : event.meta?.platform ? ` · ${event.meta.platform}` : ''}
          </p>
        </div>
        {event.isOverdue && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-coral">Overdue</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="focus-ring flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-surface-subtle"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[event.tone] || TONE_DOT.neutral}`} />
      <span className={`min-w-0 flex-1 truncate font-medium ${isDone ? 'text-faint line-through' : 'text-copy'}`}>{event.title}</span>
    </button>
  )
}
