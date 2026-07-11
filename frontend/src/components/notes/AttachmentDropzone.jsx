import { Paperclip, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { notesApi } from '../../api'
import { useToast } from '../ToastProvider'
import { formatFileSize, isAllowedAttachmentType, MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENTS_PER_NOTE } from '../../utils/notes'

export default function AttachmentDropzone({ noteId, attachmentCount = 0, onNoteUpdated }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(null)

  const atCapacity = attachmentCount >= MAX_ATTACHMENTS_PER_NOTE

  const uploadFile = async (file) => {
    if (atCapacity) {
      toast.error(`A note can have at most ${MAX_ATTACHMENTS_PER_NOTE} attachments.`)
      return
    }
    if (!isAllowedAttachmentType(file.type)) {
      toast.error('That file type is not supported.')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error(`Files must be under ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}.`)
      return
    }

    setProgress(0)
    try {
      const updated = await notesApi.uploadAttachment(noteId, file, { onProgress: setProgress })
      onNoteUpdated?.(updated)
      toast.success(`${file.name} attached.`)
    } catch (error) {
      toast.error(error.message || 'Could not upload the file.')
    } finally {
      setProgress(null)
    }
  }

  const handleFiles = (fileList) => {
    const file = fileList?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      className={`rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${isDragging ? 'border-accent bg-accent-soft/40' : 'border-line-strong'}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => { handleFiles(event.target.files); event.target.value = '' }}
      />
      {progress !== null ? (
        <div className="flex flex-col items-center gap-2 py-1 text-sm text-muted">
          <UploadCloud size={18} className="text-accent" />
          <p>Uploading… {progress}%</p>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-subtle">
            <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : atCapacity ? (
        <p className="text-xs text-faint">Attachment limit reached ({MAX_ATTACHMENTS_PER_NOTE} max).</p>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="focus-ring flex w-full flex-col items-center gap-1.5 rounded-md py-1 text-sm text-muted hover:text-ink">
          <Paperclip size={16} />
          <span><span className="font-semibold text-accent">Click to upload</span> or drag a file here</span>
          <span className="text-xs text-faint">PDF, DOC, PPT, ZIP, or image — up to {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}</span>
        </button>
      )}
    </div>
  )
}
