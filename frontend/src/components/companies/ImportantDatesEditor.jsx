import { Bell, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../ToastProvider'
import ReminderFields from '../ReminderFields'
import { formatDate } from '../../utils/format'
import { buildReminderPayload, describeReminder } from '../../utils/reminders'

const fieldClass = 'focus-ring h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-copy placeholder:text-faint transition-colors hover:border-line-strong'

const MAX_DATES = 20

// Add/remove only (no inline edit) — same interaction pattern as
// NoteLinks.jsx; correcting a date means removing and re-adding it. Persists
// immediately on each add/remove (not batched with CompanyInfoForm's single
// Save button) since this is a distinct, self-contained list.
export default function ImportantDatesEditor({ company, onUpdateDates }) {
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [reminderOffset, setReminderOffset] = useState('')
  const [customReminderAt, setCustomReminderAt] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const dates = company.importantDates || []

  const addDate = async () => {
    const trimmedLabel = label.trim()
    if (!trimmedLabel || !date || dates.length >= MAX_DATES) return

    setIsSaving(true)
    try {
      const next = [
        ...dates,
        {
          label: trimmedLabel,
          date: new Date(date).toISOString(),
          notes: notes.trim(),
          reminder: buildReminderPayload(reminderOffset, customReminderAt),
        },
      ]
      await onUpdateDates(next)
      setLabel('')
      setDate('')
      setNotes('')
      setReminderOffset('')
      setCustomReminderAt('')
    } catch (error) {
      toast.error(error.message || 'Could not add the date.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeDate = async (index) => {
    setIsSaving(true)
    try {
      await onUpdateDates(dates.filter((_, i) => i !== index))
    } catch (error) {
      toast.error(error.message || 'Could not remove the date.')
    } finally {
      setIsSaving(false)
    }
  }

  const sorted = dates.map((entry, index) => ({ ...entry, index })).sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div>
      {dates.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {sorted.map(({ label: entryLabel, date: entryDate, notes: entryNotes, reminder, index }) => (
            <div key={index} className="group flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-copy">{entryLabel}</p>
                  <span className="text-xs text-faint">{formatDate(entryDate)}</span>
                  {reminder?.enabled && (
                    <span title={`Reminder: ${describeReminder(reminder)}`} className="inline-flex items-center gap-1 text-[11px] text-accent">
                      <Bell size={11} />
                    </span>
                  )}
                </div>
                {entryNotes && <p className="mt-0.5 text-xs text-muted">{entryNotes}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeDate(index)}
                disabled={isSaving}
                aria-label={`Remove ${entryLabel}`}
                className="focus-ring hidden shrink-0 rounded p-1 text-faint hover:text-coral group-hover:block disabled:opacity-60"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {dates.length < MAX_DATES && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
            <input aria-label="Date label" placeholder="Label (e.g. OA, Technical R1)" value={label} onChange={(event) => setLabel(event.target.value)} className={fieldClass} />
            <input aria-label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${fieldClass} sm:w-40`} />
            <input aria-label="Notes" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} />
            <button
              type="button"
              onClick={addDate}
              disabled={isSaving || !label.trim() || !date}
              aria-label="Add important date"
              className="focus-ring grid h-10 place-items-center rounded-md bg-surface-subtle px-3 text-muted transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
          <ReminderFields
            reminderOffset={reminderOffset}
            setReminderOffset={setReminderOffset}
            customReminderAt={customReminderAt}
            setCustomReminderAt={setCustomReminderAt}
          />
        </div>
      )}
    </div>
  )
}
