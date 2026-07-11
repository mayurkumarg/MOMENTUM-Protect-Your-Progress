import { LoaderCircle, Paperclip, Pin, SquareCheck, Trash2 } from 'lucide-react'
import { Card, IconButton } from '../ui'
import { formatDayLabel } from '../../utils/format'
import { getNoteSnippet, getNoteTitle } from '../../utils/notes'

export default function NoteCard({ note, onOpen, onTogglePin, onDelete, isPinning, isDeleting }) {
  const checklistTotal = note.checklistItems?.length || 0
  const checklistDone = note.checklistItems?.filter((item) => item.isCompleted).length || 0
  const attachmentCount = note.attachments?.length || 0
  const snippet = getNoteSnippet(note)

  return (
    <Card hover className="group relative flex min-h-40 flex-col p-4">
      <button type="button" onClick={() => onOpen(note)} className="focus-ring flex min-w-0 flex-1 flex-col items-start text-left">
        <div className="flex w-full items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-ink">{getNoteTitle(note)}</p>
        </div>
        {snippet ? (
          <p className="mt-1.5 line-clamp-3 flex-1 text-[13px] leading-5 text-muted">{snippet}</p>
        ) : (
          <p className="mt-1.5 flex-1 text-[13px] italic leading-5 text-faint">No content yet</p>
        )}
        <div className="mt-3 flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-faint">
          <span>{formatDayLabel(note.updatedAt)}</span>
          {checklistTotal > 0 && (
            <span className="inline-flex items-center gap-1"><SquareCheck size={12} />{checklistDone}/{checklistTotal}</span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1"><Paperclip size={12} />{attachmentCount}</span>
          )}
        </div>
      </button>

      {note.isPinned && (
        <span className="absolute right-3 top-3 text-accent transition-opacity group-hover:opacity-0" aria-hidden="true">
          <Pin size={13} fill="currentColor" />
        </span>
      )}

      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          icon={isPinning ? LoaderCircle : Pin}
          label={note.isPinned ? 'Unpin note' : 'Pin note'}
          onClick={() => onTogglePin(note)}
          disabled={isPinning}
          className={`size-7 ${note.isPinned ? 'bg-accent-soft text-accent' : 'bg-surface text-faint hover:bg-surface-subtle hover:text-ink'}`}
          iconProps={{ size: 13, className: isPinning ? 'animate-spin' : '', fill: !isPinning && note.isPinned ? 'currentColor' : 'none' }}
        />
        <IconButton
          icon={isDeleting ? LoaderCircle : Trash2}
          label="Delete note"
          onClick={() => onDelete(note)}
          disabled={isDeleting}
          className="size-7 bg-surface text-faint hover:bg-coral-soft hover:text-coral"
          iconProps={{ size: 13, className: isDeleting ? 'animate-spin' : '' }}
        />
      </div>
    </Card>
  )
}
