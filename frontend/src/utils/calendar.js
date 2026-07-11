// Pure date-grid math for the Calendar page — no calendar library, plain Date
// arithmetic (matches this app's consistently low-dependency approach).
// Monday-start weeks throughout, matching AnalyticsCharts.jsx's ActivityHeatmap
// (Mon-first day labels) so the whole app shares one week-start convention.

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

// Date.getDay() is Sunday=0..Saturday=6; this re-indexes to Monday=0..Sunday=6.
function mondayIndex(date) {
  return (date.getDay() + 6) % 7
}

function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - mondayIndex(d))
  return d
}

function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return endOfDay(d)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function isSameDay(a, b) {
  return a instanceof Date && b instanceof Date && a.toDateString() === b.toDateString()
}

export function isToday(date) {
  return isSameDay(date, new Date())
}

export function getWeekDays(date) {
  const start = startOfWeek(date)
  const days = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return { days, start, end: endOfWeek(date) }
}

// A padded 5-6 week matrix (always full weeks) so the grid is rectangular —
// leading/trailing days from adjacent months are included (isCurrentMonth:false)
// both for correct visual layout and so their real events still fetch/render.
export function getMonthGrid(date) {
  const monthStart = startOfMonth(date)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(endOfMonth(date))

  const weeks = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const week = []
    for (let i = 0; i < 7; i += 1) {
      week.push({ date: new Date(cursor), isCurrentMonth: cursor.getMonth() === date.getMonth() })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return { weeks, start: gridStart, end: endOfDay(gridEnd) }
}

export function getVisibleRange(view, date) {
  if (view === 'Month') {
    const { start, end } = getMonthGrid(date)
    return { start, end }
  }
  if (view === 'Week') {
    const { start, end } = getWeekDays(date)
    return { start, end }
  }
  return { start: startOfDay(date), end: endOfDay(date) }
}

export function formatPeriodLabel(view, date) {
  if (view === 'Month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
  }
  if (view === 'Week') {
    const { start, end } = getWeekDays(date)
    const sameMonth = start.getMonth() === end.getMonth()
    const startLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)
    const endLabel = new Intl.DateTimeFormat(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }).format(end)
    const year = new Intl.DateTimeFormat(undefined, { year: 'numeric' }).format(end)
    return `${startLabel} – ${endLabel}, ${year}`
  }
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

// direction: -1 (previous) or 1 (next) — moves currentDate by one unit of the active view.
export function shiftDate(view, date, direction) {
  const next = new Date(date)
  if (view === 'Month') next.setMonth(next.getMonth() + direction)
  else if (view === 'Week') next.setDate(next.getDate() + direction * 7)
  else next.setDate(next.getDate() + direction)
  return next
}
