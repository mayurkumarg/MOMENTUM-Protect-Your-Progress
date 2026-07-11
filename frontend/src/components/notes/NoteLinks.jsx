import { ExternalLink, Github, Link2, Plus, Trash2, Youtube } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../ui'

const MAX_LINKS = 20

function getLinkIcon(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('youtube.com') || host.includes('youtu.be')) return Youtube
    if (host.includes('github.com')) return Github
    return Link2
  } catch {
    return Link2
  }
}

function getLinkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Same "whole array in parent form state" convention as NoteChecklist —
// the parent (NoteEditor) owns `links` and sends it back whole on save.
export default function NoteLinks({ links = [], onChange }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const addLink = () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    if (links.length >= MAX_LINKS) return

    let normalized = trimmedUrl
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`

    try {
      new URL(normalized)
    } catch {
      setError('That link looks invalid.')
      return
    }

    setError('')
    onChange([...links, { label: label.trim(), url: normalized }])
    setLabel('')
    setUrl('')
  }

  const removeLink = (index) => onChange(links.filter((_, i) => i !== index))

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addLink()
    }
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-copy">Useful links</span>

      {links.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {links.map((link, index) => {
            const Icon = getLinkIcon(link.url)
            return (
              <div key={index} className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={14} /></span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-copy hover:text-accent">{link.label || getLinkHost(link.url)}</p>
                  <p className="truncate text-xs text-faint">{getLinkHost(link.url)}</p>
                </a>
                <ExternalLink size={12} className="shrink-0 text-faint" />
                <IconButton
                  icon={Trash2}
                  label={`Remove link ${link.label || link.url}`}
                  onClick={() => removeLink(index)}
                  className="size-7 shrink-0 text-faint opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                  iconProps={{ size: 13 }}
                />
              </div>
            )
          })}
        </div>
      )}

      {links.length < MAX_LINKS && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Label (optional)"
              className="focus-ring h-9 w-2/5 rounded-md border border-line bg-surface px-2.5 text-sm text-copy placeholder:text-faint"
            />
            <input
              value={url}
              onChange={(event) => { setUrl(event.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="https://..."
              className="focus-ring h-9 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-copy placeholder:text-faint"
            />
            <IconButton icon={Plus} label="Add link" onClick={addLink} className="size-9 shrink-0" iconProps={{ size: 16 }} />
          </div>
          {error && <p className="text-xs text-coral">{error}</p>}
        </div>
      )}
    </div>
  )
}
