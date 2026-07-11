export const COMPANY_STATUS_OPTIONS = [
  { value: 'WISHLIST', label: 'Wishlist', tone: 'neutral' },
  { value: 'PREPARING', label: 'Preparing', tone: 'yellow' },
  { value: 'APPLIED', label: 'Applied', tone: 'yellow' },
  { value: 'OA_SCHEDULED', label: 'OA Scheduled', tone: 'yellow' },
  { value: 'OA_COMPLETED', label: 'OA Completed', tone: 'yellow' },
  { value: 'INTERVIEWING', label: 'Interviewing', tone: 'yellow' },
  { value: 'SELECTED', label: 'Selected', tone: 'green' },
  { value: 'REJECTED', label: 'Rejected', tone: 'coral' },
  { value: 'WITHDRAWN', label: 'Withdrawn', tone: 'neutral' },
]

// The non-terminal pipeline, in order — used for the "how far along" progress
// bar. Terminal states (Selected/Rejected/Withdrawn) are handled separately:
// Selected reads as fully complete, Rejected/Withdrawn as stopped, neither as
// "N of 6 stages".
const PIPELINE_STAGES = ['WISHLIST', 'PREPARING', 'APPLIED', 'OA_SCHEDULED', 'OA_COMPLETED', 'INTERVIEWING']
const TERMINAL_STATUSES = ['SELECTED', 'REJECTED', 'WITHDRAWN']
const INTERVIEWING_LIKE = ['OA_SCHEDULED', 'OA_COMPLETED', 'INTERVIEWING']

export const PIPELINE_STAGE_COUNT = PIPELINE_STAGES.length

export function getStatusOption(status) {
  return COMPANY_STATUS_OPTIONS.find((option) => option.value === status) || COMPANY_STATUS_OPTIONS[0]
}

export function getStatusLabel(status) {
  return getStatusOption(status).label
}

export function getStatusTone(status) {
  return getStatusOption(status).tone
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status)
}

export function getPipelineIndex(status) {
  const index = PIPELINE_STAGES.indexOf(status)
  return index === -1 ? PIPELINE_STAGES.length - 1 : index
}

const AVATAR_TONES = ['bg-accent-soft text-accent', 'bg-coral-soft text-coral', 'bg-yellow-soft text-yellow']

export function getInitialAvatarTone(name = '') {
  const code = name.trim().charCodeAt(0) || 0
  return AVATAR_TONES[code % AVATAR_TONES.length]
}

export function getCompanyInitial(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function getLinkedTasks(companyId, tasks = []) {
  return tasks.filter((task) => task.companyId === companyId)
}

// null (not 0%) when there are no linked tasks yet — a real, meaningful
// "unknown" state rather than a misleading zero.
export function computePrepProgress(companyId, tasks = []) {
  const linked = getLinkedTasks(companyId, tasks)
  if (linked.length === 0) return null
  const completed = linked.filter((task) => task.status === 'COMPLETED').length
  return Math.round((completed / linked.length) * 100)
}

// Nearest upcoming (today or later) important date, or null.
export function getNextImportantDate(company) {
  const now = new Date()
  const upcoming = (company.importantDates || [])
    .filter((entry) => entry.date && new Date(entry.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  return upcoming[0] || null
}

// Status-driven, not label-parsed — importantDates labels are free text
// ("OA", "Technical R1", ...) and shouldn't be relied on for classification.
export function computePlacementStats(companies = []) {
  const total = companies.length
  const preparing = companies.filter((company) => company.status === 'PREPARING').length
  const applied = companies.filter((company) => !['WISHLIST', 'PREPARING'].includes(company.status)).length
  const interviews = companies.filter((company) => INTERVIEWING_LIKE.includes(company.status)).length
  const offers = companies.filter((company) => company.status === 'SELECTED').length
  const rejections = companies.filter((company) => company.status === 'REJECTED').length
  const upcomingOAs = companies.filter((company) => company.status === 'OA_SCHEDULED' && getNextImportantDate(company)).length
  const upcomingInterviews = companies.filter((company) => company.status === 'INTERVIEWING' && getNextImportantDate(company)).length

  return { total, applied, preparing, interviews, offers, rejections, upcomingInterviews, upcomingOAs }
}

export function sortCompaniesByRecent(companies = []) {
  return [...companies].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}
