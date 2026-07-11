import { X } from 'lucide-react'
import { useState } from 'react'

// Type-and-press-Enter chip entry for freeform tags. Generic enough to reuse
// anywhere a short list of labels needs editing, not just tasks.
export default function TagInput({ label = 'Tags', value = [], onChange, placeholder = 'Add a tag and press Enter' }) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const tag = draft.trim().toLowerCase()
    setDraft('')
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
  }

  const removeTag = (tag) => onChange(value.filter((existing) => existing !== tag))

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-copy">{label}</span>
      <div className="focus-ring flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-2 transition-colors focus-within:border-accent">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="rounded-full hover:opacity-70" aria-label={`Remove tag ${tag}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-copy placeholder:text-faint focus:outline-none"
        />
      </div>
    </label>
  )
}
