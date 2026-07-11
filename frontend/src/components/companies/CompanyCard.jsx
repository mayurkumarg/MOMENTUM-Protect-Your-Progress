import { CalendarClock, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Card } from '../ui'
import CompanyAvatar from './CompanyAvatar'
import { formatDayLabel } from '../../utils/format'
import { getNextImportantDate, getStatusLabel, getStatusTone } from '../../utils/companies'

export default function CompanyCard({ company }) {
  const navigate = useNavigate()
  const nextDate = getNextImportantDate(company)

  return (
    <Card hover className="p-0">
      <button type="button" onClick={() => navigate(`/placements/${company.id}`)} className="focus-ring block w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={company} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold text-ink">{company.name}</p>
            {company.role && <p className="truncate text-sm text-muted">{company.role}</p>}
          </div>
          <Badge tone={getStatusTone(company.status)}>{getStatusLabel(company.status)}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          {company.location && (
            <span className="inline-flex items-center gap-1"><MapPin size={12} />{company.location}</span>
          )}
          {nextDate && (
            <span className="inline-flex items-center gap-1 font-medium text-accent">
              <CalendarClock size={12} />{nextDate.label} · {formatDayLabel(nextDate.date)}
            </span>
          )}
        </div>
      </button>
    </Card>
  )
}
