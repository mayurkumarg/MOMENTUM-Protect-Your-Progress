import { Bold, Code, Eye, Heading2, Italic, List, LoaderCircle, PencilLine, Quote, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button, IconButton } from '../ui'
import Markdown from '../Markdown'
import NoteChecklist from './NoteChecklist'
import NoteLinks from './NoteLinks'
import AttachmentDropzone from './AttachmentDropzone'
import AttachmentList from './AttachmentList'

// Wraps the current selection (or inserts a placeholder at the cursor when
// nothing is selected) with the given markers — the textarea toolbar's core
// primitive. Deliberately plain-textarea manipulation, not a rich editor.
function wrapSelection(textarea, before, after, placeholder) {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd) || placeholder
  const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`
  const cursor = selectionStart + before.length + selected.length + after.length
  return { next, cursor }
}

// Prefixes each line touched by the current selection with `prefix` —
// used for heading/list/quote toolbar buttons.
function prefixLines(textarea, prefix) {
  const { selectionStart, selectionEnd, value } = textarea
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  let lineEnd = value.indexOf('\n', selectionEnd)
  if (lineEnd === -1) lineEnd = value.length

  const block = value.slice(lineStart, lineEnd)
  const prefixed = block.split('\n').map((line) => `${prefix}${line}`).join('\n')
  const next = `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`
  const cursor = selectionEnd + prefix.length

  return { next, cursor }
}

const TOOLBAR_ACTIONS = [
  { icon: Bold, label: 'Bold', apply: (ta) => wrapSelection(ta, '**', '**', 'bold text') },
  { icon: Italic, label: 'Italic', apply: (ta) => wrapSelection(ta, '*', '*', 'italic text') },
  { icon: Heading2, label: 'Heading', apply: (ta) => prefixLines(ta, '## ') },
  { icon: List, label: 'Bulleted list', apply: (ta) => prefixLines(ta, '- ') },
  { icon: Quote, label: 'Quote', apply: (ta) => prefixLines(ta, '> ') },
  { icon: Code, label: 'Code block', apply: (ta) => wrapSelection(ta, '\n```\n', '\n```\n', 'code here') },
]

const emptyForm = (note) => ({
  title: note?.title || '',
  body: note?.body || '',
  checklistItems: note?.checklistItems || [],
  links: note?.links || [],
})

export default function NoteEditor({ note, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => emptyForm(note))
  const [currentNote, setCurrentNote] = useState(note) // becomes non-null once a new note is first saved, enabling attachments
  const [isPreview, setIsPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const textareaRef = useRef(null)

  const isNew = !currentNote
  const hasContent = form.title.trim().length > 0 || form.body.trim().length > 0

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const applyToolbarAction = (action) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { next, cursor } = action.apply(textarea)
    updateField('body', next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handleSave = async () => {
    if (!hasContent || isSaving) return
    setIsSaving(true)
    try {
      const saved = await onSave(currentNote?.id, {
        title: form.title.trim(),
        body: form.body.trim(),
        checklistItems: form.checklistItems,
        links: form.links,
      })
      setCurrentNote(saved)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentNote || isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete(currentNote)
    } finally {
      setIsDeleting(false)
    }
  }

  const attachmentCount = currentNote?.attachments?.length || 0

  const preview = useMemo(() => form.body, [form.body])

  return (
    <div className="animate-pop-in flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
        <input
          value={form.title}
          onChange={(event) => updateField('title', event.target.value)}
          placeholder="Untitled note"
          className="focus-ring min-w-0 flex-1 rounded-md bg-transparent px-1 font-display text-lg font-bold text-ink placeholder:text-faint"
        />
        <div className="flex shrink-0 items-center gap-2">
          {currentNote && (
            <IconButton icon={Trash2} label="Delete note" onClick={handleDelete} disabled={isDeleting} className="hover:bg-coral-soft hover:text-coral" />
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={!hasContent || isSaving}>
            {isSaving && <LoaderCircle className="animate-spin" size={15} />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-surface-subtle p-1">
                {TOOLBAR_ACTIONS.map(({ icon: Icon, label, apply }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    disabled={isPreview}
                    onClick={() => applyToolbarAction({ apply })}
                    className="focus-ring grid size-7 place-items-center rounded text-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsPreview((value) => !value)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-subtle hover:text-ink"
              >
                {isPreview ? <PencilLine size={13} /> : <Eye size={13} />}
                {isPreview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {isPreview ? (
              <div className="min-h-[220px] rounded-lg border border-line bg-surface px-4 py-3.5">
                {preview.trim() ? <Markdown content={preview} /> : <p className="text-sm italic text-faint">Nothing to preview yet.</p>}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={form.body}
                onChange={(event) => updateField('body', event.target.value)}
                placeholder="Write in Markdown — headings, lists, `code`, and more."
                rows={10}
                className="focus-ring w-full resize-y rounded-lg border border-line bg-surface px-4 py-3.5 text-sm leading-6 text-copy placeholder:text-faint"
              />
            )}
          </div>

          <div className="rounded-lg border border-line p-4">
            <NoteChecklist items={form.checklistItems} onChange={(items) => updateField('checklistItems', items)} />
          </div>

          <div className="rounded-lg border border-line p-4">
            <NoteLinks links={form.links} onChange={(links) => updateField('links', links)} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-copy">Attachments</span>
              {attachmentCount > 0 && <span className="text-xs text-faint">{attachmentCount} file{attachmentCount === 1 ? '' : 's'}</span>}
            </div>
            {isNew ? (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-4 text-center text-xs text-faint">Save the note first to attach files.</p>
            ) : (
              <div className="space-y-3">
                <AttachmentList noteId={currentNote.id} attachments={currentNote.attachments} onNoteUpdated={setCurrentNote} />
                <AttachmentDropzone noteId={currentNote.id} attachmentCount={attachmentCount} onNoteUpdated={setCurrentNote} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
