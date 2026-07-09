import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

const MAX_SUBTASKS = 10

// Local, uncontrolled-until-saved checklist editor — the parent form holds
// the `subtasks` array in its own state and sends the whole thing back on
// submit, matching how the rest of the task edit form already works (one
// PATCH on save, not a call per change).
export default function SubtaskChecklist({ subtasks = [], onChange }) {
  const [draft, setDraft] = useState('')

  const addSubtask = () => {
    const title = draft.trim()
    setDraft('')
    if (!title || subtasks.length >= MAX_SUBTASKS) return
    onChange([...subtasks, { title, isCompleted: false }])
  }

  const toggleSubtask = (index) => {
    onChange(subtasks.map((subtask, i) => (i === index ? { ...subtask, isCompleted: !subtask.isCompleted } : subtask)))
  }

  const removeSubtask = (index) => {
    onChange(subtasks.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addSubtask()
    }
  }

  const completedCount = subtasks.filter((subtask) => subtask.isCompleted).length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-copy">Subtasks</span>
        {subtasks.length > 0 && <span className="text-xs text-faint">{completedCount} of {subtasks.length} done</span>}
      </div>

      {subtasks.length > 0 && (
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      {subtasks.length > 0 && (
        <div className="mb-2 space-y-1">
          {subtasks.map((subtask, index) => (
            <div key={index} className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface-subtle">
              <button
                type="button"
                onClick={() => toggleSubtask(index)}
                aria-label={`${subtask.isCompleted ? 'Reopen' : 'Complete'} ${subtask.title}`}
                className={`focus-ring grid size-5 shrink-0 place-items-center rounded border transition-colors ${subtask.isCompleted ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent hover:border-accent'}`}
              >
                <Check size={12} />
              </button>
              <span className={`flex-1 truncate text-sm ${subtask.isCompleted ? 'text-faint line-through' : 'text-copy'}`}>{subtask.title}</span>
              <button
                type="button"
                onClick={() => removeSubtask(index)}
                aria-label={`Remove ${subtask.title}`}
                className="focus-ring hidden shrink-0 rounded p-1 text-faint hover:text-coral group-hover:block"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {subtasks.length < MAX_SUBTASKS && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a subtask..."
            className="focus-ring h-9 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-copy placeholder:text-faint"
          />
          <button
            type="button"
            onClick={addSubtask}
            aria-label="Add subtask"
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
