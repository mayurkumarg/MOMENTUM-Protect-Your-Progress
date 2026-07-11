import { LoaderCircle } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-dialog-title">
      <h2 id="confirm-dialog-title" className="font-display text-[15px] font-bold text-ink">{title}</h2>
      {description && <p className="mt-2 text-sm leading-5 text-muted">{description}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={isLoading}>
          {isLoading && <LoaderCircle className="animate-spin" size={15} />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
