import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../ui'

const MAX_ITEMS = 30

// Local, uncontrolled-until-saved checklist editor for a note — the parent
// (NoteEditor) holds `checklistItems` in its own form state and sends the
// whole array back on save, same convention as SubtaskChecklist.jsx for tasks.
export default function NoteChecklist({ items = [], onChange }) {
  const [draft, setDraft] = useState('')

  const addItem = () => {
    const text = draft.trim()
    setDraft('')
    if (!text || items.length >= MAX_ITEMS) return
    onChange([...items, { text, isCompleted: false }])
  }

  const toggleItem = (index) => {
    onChange(items.map((item, i) => (i === index ? { ...item, isCompleted: !item.isCompleted } : item)))
  }

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addItem()
    }
  }

  const completedCount = items.filter((item) => item.isCompleted).length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-copy">Checklist</span>
        {items.length > 0 && <span className="text-xs text-faint">{completedCount} of {items.length} done</span>}
      </div>

      {items.length > 0 && (
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-2 space-y-1">
          {items.map((item, index) => (
            <div key={index} className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface-subtle">
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-label={`${item.isCompleted ? 'Reopen' : 'Complete'} ${item.text}`}
                className={`focus-ring grid size-5 shrink-0 place-items-center rounded border transition-colors ${item.isCompleted ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent hover:border-accent'}`}
              >
                <Check size={12} />
              </button>
              <span className={`flex-1 truncate text-sm ${item.isCompleted ? 'text-faint line-through' : 'text-copy'}`}>{item.text}</span>
              <IconButton
                icon={Trash2}
                label={`Remove ${item.text}`}
                onClick={() => removeItem(index)}
                className="size-7 shrink-0 text-faint opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                iconProps={{ size: 13 }}
              />
            </div>
          ))}
        </div>
      )}

      {items.length < MAX_ITEMS && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a checklist item..."
            className="focus-ring h-9 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-copy placeholder:text-faint"
          />
          <IconButton icon={Plus} label="Add checklist item" onClick={addItem} className="size-9 shrink-0" iconProps={{ size: 16 }} />
        </div>
      )}
    </div>
  )
}
