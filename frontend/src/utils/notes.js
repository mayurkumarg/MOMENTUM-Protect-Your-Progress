import { Archive, File, FileText, Image, Presentation } from 'lucide-react'

// Mirrors backend/modules/notes/upload.middleware.js's ALLOWED_MIME_EXTENSIONS —
// kept here only for fast client-side feedback; the server is the source of truth.
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
]

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024 // 15MB
export const MAX_ATTACHMENTS_PER_NOTE = 10

export function isAllowedAttachmentType(mimeType) {
  return ALLOWED_ATTACHMENT_TYPES.includes(mimeType)
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation
  if (mimeType.includes('zip')) return Archive
  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType === 'text/plain') return FileText
  return File
}

export function splitPinned(notes = []) {
  return {
    pinned: notes.filter((note) => note.isPinned),
    unpinned: notes.filter((note) => !note.isPinned),
  }
}

export function sortNotesByRecent(notes = []) {
  return [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export function filterNotesBySearch(notes = [], term = '') {
  const query = term.trim().toLowerCase()
  if (!query) return notes

  return notes.filter((note) => {
    const title = (note.title || '').toLowerCase()
    const body = (note.body || '').toLowerCase()
    const links = (note.links || []).map((link) => `${link.label} ${link.url}`.toLowerCase()).join(' ')
    return title.includes(query) || body.includes(query) || links.includes(query)
  })
}

// A short plain-text preview for the note card — strips the most common
// Markdown punctuation so the snippet reads cleanly instead of showing raw syntax.
export function getNoteSnippet(note, maxLength = 140) {
  const source = note.body || ''
  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) return ''
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trim()}…` : plain
}

export function getNoteTitle(note) {
  return note.title?.trim() || 'Untitled note'
}
