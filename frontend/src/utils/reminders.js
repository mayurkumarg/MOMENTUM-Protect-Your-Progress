// Generic reminder helpers — operate on the plain `{enabled, offsetMinutes,
// isCustom, remindAt}` shape shared by Task.reminder and a placement event's
// reminder (backend/modules/companies/company.model.js), so both Tasks.jsx
// and ImportantDatesEditor.jsx drive the same reminder picker off this one
// place instead of duplicating the offset/custom-time logic.

// `minutes` is the number of minutes before the anchor time (a task's
// deadline, or an event's 9am-default time); 'custom' means the reminder
// carries its own absolute remindAt instead of an offset.
export const REMINDER_OPTIONS = [
  { value: '0', label: 'At due time', minutes: 0 },
  { value: '5', label: '5 minutes before', minutes: 5 },
  { value: '15', label: '15 minutes before', minutes: 15 },
  { value: '30', label: '30 minutes before', minutes: 30 },
  { value: '60', label: '1 hour before', minutes: 60 },
  { value: '1440', label: '1 day before', minutes: 1440 },
  { value: 'custom', label: 'Custom time...', minutes: null },
]

// Human label for a reminder setting, e.g. "1 hour before" or "Custom time"
// — used wherever a reminder needs a one-line summary.
export function describeReminder(reminder) {
  if (!reminder?.enabled) return null
  if (reminder.isCustom) return 'Custom time'
  const match = REMINDER_OPTIONS.find((option) => option.minutes === reminder.offsetMinutes)
  return match ? match.label : `${reminder.offsetMinutes} minutes before`
}

// Turns the reminder form fields (a select value + optional custom
// datetime-local string) into the `reminder` object the API expects.
export function buildReminderPayload(reminderOffset, customReminderAt) {
  if (!reminderOffset) {
    return { enabled: false, offsetMinutes: 0, isCustom: false, remindAt: null }
  }

  if (reminderOffset === 'custom') {
    if (!customReminderAt) return { enabled: false, offsetMinutes: 0, isCustom: false, remindAt: null }
    return { enabled: true, offsetMinutes: 0, isCustom: true, remindAt: new Date(customReminderAt).toISOString() }
  }

  return { enabled: true, offsetMinutes: Number(reminderOffset), isCustom: false, remindAt: null }
}

// Inverse of buildReminderPayload — derives the form's select value from a
// stored reminder, for pre-filling an edit form.
export function reminderToFormValue(reminder) {
  if (!reminder?.enabled) return ''
  if (reminder.isCustom) return 'custom'
  return String(reminder.offsetMinutes ?? 0)
}
