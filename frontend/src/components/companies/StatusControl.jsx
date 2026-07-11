import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../ToastProvider'
import { Badge } from '../ui'
import { COMPANY_STATUS_OPTIONS, PIPELINE_STAGE_COUNT, getPipelineIndex, getStatusTone, isTerminalStatus } from '../../utils/companies'

const SEGMENT_TONE = { neutral: 'bg-faint', green: 'bg-accent', coral: 'bg-coral', yellow: 'bg-yellow' }

// A <select> (9 options) rather than a visual step-by-step stepper — 9 labeled
// steps would be too wide to read at any reasonable width. A slim segmented
// bar underneath gives the "how far along" glance a stepper would, without
// the width problem.
export default function StatusControl({ company, onUpdateStatus }) {
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = async (event) => {
    const nextStatus = event.target.value
    setIsSaving(true)
    try {
      await onUpdateStatus(nextStatus)
    } catch (error) {
      toast.error(error.message || 'Could not update status.')
    } finally {
      setIsSaving(false)
    }
  }

  // getPipelineIndex maps any terminal status to the last pipeline slot, so
  // Selected/Rejected/Withdrawn all read as "process complete" (bar fully
  // filled) — green for Selected, coral for the other two — rather than a
  // partial bar, since the stage reached before a rejection isn't tracked.
  const filledSegments = getPipelineIndex(company.status) + 1
  const segmentTone = isTerminalStatus(company.status) && company.status !== 'SELECTED' ? SEGMENT_TONE.coral : SEGMENT_TONE.green

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <select
          value={company.status}
          onChange={handleChange}
          disabled={isSaving}
          className="focus-ring h-10 rounded-md border border-line bg-surface px-3 text-sm font-semibold text-copy disabled:opacity-60"
        >
          {COMPANY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {isSaving ? <LoaderCircle size={16} className="animate-spin text-muted" /> : <Badge tone={getStatusTone(company.status)}>Current</Badge>}
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: PIPELINE_STAGE_COUNT }).map((_, index) => (
          <span key={index} className={`h-1.5 w-6 rounded-full transition-colors ${index < filledSegments ? segmentTone : 'bg-surface-subtle'}`} />
        ))}
      </div>
    </div>
  )
}
