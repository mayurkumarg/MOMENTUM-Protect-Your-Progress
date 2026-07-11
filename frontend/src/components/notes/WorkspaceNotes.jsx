import { NotebookText, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import NoteCard from './NoteCard'
import NoteEditor from './NoteEditor'
import { useToast } from '../ToastProvider'
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Section } from '../ui'
import { useNotes } from '../../hooks/useNotes'
import { filterNotesBySearch, sortNotesByRecent, splitPinned } from '../../utils/notes'

// The shared "notes workspace" experience — search, pinned/unpinned grid, the
// editor toggle — extracted so any entity (a Task, a Placement Tracker
// Company, ...) gets the identical notes UI for free. Owns its own "New
// note" trigger (via Section's action slot) rather than requiring the parent
// page to place one, since embedding pages vary (a task workspace page is
// ~just this; a company detail page has several other sections above it).
export default function WorkspaceNotes({ entityType, entityId, emptyStateTitle = 'This workspace is empty', emptyStateDescription }) {
  const toast = useToast()
  const { notes, isLoading, error, refetch, addNote, updateNote, removeNote } = useNotes(entityType, entityId)

  const [activeNote, setActiveNote] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pinningId, setPinningId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const isEditorOpen = isCreating || Boolean(activeNote)

  const visibleNotes = useMemo(() => sortNotesByRecent(filterNotesBySearch(notes, searchTerm)), [notes, searchTerm])
  const { pinned, unpinned } = useMemo(() => splitPinned(visibleNotes), [visibleNotes])

  const closeEditor = () => {
    setActiveNote(null)
    setIsCreating(false)
  }

  const handleSaveNote = async (noteId, payload) => {
    try {
      const saved = noteId ? await updateNote(noteId, payload) : await addNote(payload)
      toast.success(noteId ? 'Note updated.' : 'Note created.')
      return saved
    } catch (saveError) {
      toast.error(saveError.message || 'Could not save the note.')
      throw saveError
    }
  }

  const handleDeleteNote = async (note) => {
    try {
      await removeNote(note.id)
      toast.success('Note deleted.')
      closeEditor()
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the note.')
      throw deleteError
    }
  }

  const handleTogglePin = async (note) => {
    setPinningId(note.id)
    try {
      await updateNote(note.id, { isPinned: !note.isPinned })
    } catch (pinError) {
      toast.error(pinError.message || 'Could not update the note.')
    } finally {
      setPinningId(null)
    }
  }

  const confirmDeleteFromGrid = async () => {
    if (!pendingDelete) return
    setDeletingId(pendingDelete.id)
    try {
      await removeNote(pendingDelete.id)
      toast.success('Note deleted.')
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the note.')
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  if (isEditorOpen) {
    return (
      <Card className="min-h-[600px] overflow-hidden">
        <NoteEditor note={activeNote} onSave={handleSaveNote} onDelete={handleDeleteNote} onClose={closeEditor} />
      </Card>
    )
  }

  return (
    <Section title="Notes" action={<Button icon={Plus} onClick={() => setIsCreating(true)}>New note</Button>}>
      <div className="space-y-5">
        {notes.length > 0 && (
          <div className="max-w-sm">
            <Input label="Search notes" placeholder="Title, content, or link" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        )}

        {isLoading ? (
          <Card><LoadingState label="Loading workspace" /></Card>
        ) : error ? (
          <Card><ErrorState title="Workspace could not load" description={error.message} action={<Button variant="secondary" onClick={() => refetch().catch((retryError) => toast.error(retryError.message || 'Still unable to load.'))}>Retry</Button>} /></Card>
        ) : notes.length === 0 ? (
          <Card>
            <EmptyState
              icon={NotebookText}
              title={emptyStateTitle}
              description={emptyStateDescription}
              action={<Button icon={Plus} onClick={() => setIsCreating(true)}>Add your first note</Button>}
            />
          </Card>
        ) : visibleNotes.length === 0 ? (
          <Card><EmptyState icon={Search} title="No matching notes" description={`Nothing matches "${searchTerm.trim()}".`} action={<Button variant="secondary" onClick={() => setSearchTerm('')}>Clear search</Button>} /></Card>
        ) : (
          <div className="space-y-7">
            {pinned.length > 0 && (
              <Section title="Pinned" description={`${pinned.length} pinned note${pinned.length === 1 ? '' : 's'}`}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pinned.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onOpen={setActiveNote}
                      onTogglePin={handleTogglePin}
                      onDelete={setPendingDelete}
                      isPinning={pinningId === note.id}
                      isDeleting={deletingId === note.id}
                    />
                  ))}
                </div>
              </Section>
            )}
            <Section title={pinned.length > 0 ? 'All notes' : undefined} description={pinned.length > 0 ? 'Most recently edited first.' : undefined}>
              {unpinned.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {unpinned.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onOpen={setActiveNote}
                      onTogglePin={handleTogglePin}
                      onDelete={setPendingDelete}
                      isPinning={pinningId === note.id}
                      isDeleting={deletingId === note.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Every note here is pinned.</p>
              )}
            </Section>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.title?.trim() || 'Untitled note'}"?`}
        description="This can't be undone. Any attached files will be removed too."
        confirmLabel="Delete"
        tone="danger"
        isLoading={deletingId === pendingDelete?.id}
        onConfirm={confirmDeleteFromGrid}
        onCancel={() => setPendingDelete(null)}
      />
    </Section>
  )
}
