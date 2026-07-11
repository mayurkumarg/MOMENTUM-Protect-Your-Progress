import { Inbox } from 'lucide-react'
import { Card, EmptyState } from '../ui'
import EventChip from './EventChip'

export default function DayView({ events, onSelectEvent }) {
  const sorted = events.slice().sort((a, b) => a.date - b.date)

  if (sorted.length === 0) {
    return <Card><EmptyState icon={Inbox} title="Nothing scheduled" description="No tasks or activity fall on this day." /></Card>
  }

  return (
    <div className="space-y-2">
      {sorted.map((event) => <EventChip key={event.id} event={event} onSelect={onSelectEvent} variant="row" />)}
    </div>
  )
}
