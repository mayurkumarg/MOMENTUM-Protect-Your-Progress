export function formatDateTime(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatDate(value) {
  if (!value) return 'No deadline'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No deadline'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatMinutes(minutes) {
  if (!minutes) return 'Recorded'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

export function formatDurationHuman(seconds) {
  if (!seconds || seconds < 1) return null
  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return secs ? `${minutes}m ${secs}s` : `${minutes}m`
  return `${secs}s`
}

// Prefers the precise durationSeconds when available, falls back to the
// coarser durationMinutes otherwise — and reports whether the value is a
// real measurement or our own estimate, so callers can mark it as such.
export function formatActivityDuration(activity) {
  const fromSeconds = activity?.durationSeconds ? formatDurationHuman(activity.durationSeconds) : null
  return {
    label: fromSeconds || formatMinutes(activity?.durationMinutes),
    isEstimated: activity?.isEstimatedDuration !== false,
  }
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 5) return 'Good night.'
  if (hour < 12) return 'Good morning.'
  if (hour < 17) return 'Good afternoon.'
  if (hour < 21) return 'Good evening.'
  return 'Good night.'
}

export function toDateTimeInputValue(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
