import { Download, LoaderCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { notesApi } from '../../api'
import { useToast } from '../ToastProvider'
import { IconButton } from '../ui'
import { formatFileSize, getFileIcon } from '../../utils/notes'

export default function AttachmentList({ noteId, attachments = [], onNoteUpdated, readOnly = false }) {
  const toast = useToast()
  const [pendingId, setPendingId] = useState(null)

  const handleDownload = async (attachment) => {
    setPendingId(`dl-${attachment.id}`)
    try {
      await notesApi.downloadAttachment(noteId, attachment.id, attachment.filename)
    } catch (error) {
      toast.error(error.message || 'Could not download the attachment.')
    } finally {
      setPendingId(null)
    }
  }

  const handleDelete = async (attachment) => {
    setPendingId(`del-${attachment.id}`)
    try {
      const updated = await notesApi.deleteAttachment(noteId, attachment.id)
      onNoteUpdated?.(updated)
      toast.success('Attachment removed.')
    } catch (error) {
      toast.error(error.message || 'Could not remove the attachment.')
    } finally {
      setPendingId(null)
    }
  }

  if (attachments.length === 0) return null

  return (
    <div className="space-y-1.5">
      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.mimeType)
        const isDownloading = pendingId === `dl-${attachment.id}`
        const isDeleting = pendingId === `del-${attachment.id}`

        return (
          <div key={attachment.id} className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-copy">{attachment.filename}</p>
              <p className="text-xs text-faint">{formatFileSize(attachment.size)}</p>
            </div>
            <IconButton
              icon={isDownloading ? LoaderCircle : Download}
              label={`Download ${attachment.filename}`}
              onClick={() => handleDownload(attachment)}
              disabled={isDownloading}
              className="size-8 shrink-0 disabled:opacity-60"
              iconProps={{ size: 14, className: isDownloading ? 'animate-spin' : '' }}
            />
            {!readOnly && (
              <IconButton
                icon={isDeleting ? LoaderCircle : Trash2}
                label={`Delete ${attachment.filename}`}
                onClick={() => handleDelete(attachment)}
                disabled={isDeleting}
                className="size-8 shrink-0 text-faint opacity-0 transition-colors hover:bg-coral-soft hover:text-coral group-hover:opacity-100 disabled:opacity-60"
                iconProps={{ size: 14, className: isDeleting ? 'animate-spin' : '' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
