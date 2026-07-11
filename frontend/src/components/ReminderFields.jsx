import { Input } from './ui'
import { REMINDER_OPTIONS } from '../utils/reminders'

// Requesting Notification permission here (not on page load) ties the
// browser prompt to a direct user action — enabling a reminder — which is
// both good practice and far more likely to be granted than an ambient ask.
const requestNotificationPermission = () => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

// Offset dropdown + custom date/time input, shared by the Task form
// (Tasks.jsx) and the placement-event reminder toggle
// (components/companies/ImportantDatesEditor.jsx) — same reminder shape
// (utils/reminders.js), same picker, so both stay in sync automatically.
export default function ReminderFields({ reminderOffset, setReminderOffset, customReminderAt, setCustomReminderAt, deadline }) {
  const handleReminderChange = (value) => {
    setReminderOffset(value)
    if (value) requestNotificationPermission()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-copy">Reminder</span>
        <select
          value={reminderOffset}
          onChange={(event) => handleReminderChange(event.target.value)}
          className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy"
        >
          <option value="">No reminder</option>
          {REMINDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {reminderOffset === 'custom' && (
        <Input
          label="Remind me at"
          type="datetime-local"
          value={customReminderAt}
          onChange={(event) => setCustomReminderAt(event.target.value)}
          max={deadline}
          required
        />
      )}
    </div>
  )
}
