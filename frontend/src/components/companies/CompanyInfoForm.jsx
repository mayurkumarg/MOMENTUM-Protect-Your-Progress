import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Input } from '../ui'
import { useToast } from '../ToastProvider'
import { toDateTimeInputValue } from '../../utils/format'

const toForm = (company) => ({
  name: company.name || '',
  logoUrl: company.logoUrl || '',
  role: company.role || '',
  location: company.location || '',
  packageInfo: company.packageInfo || '',
  resumeVersion: company.resumeVersion || '',
  applicationDate: company.applicationDate ? toDateTimeInputValue(company.applicationDate).slice(0, 10) : '',
})

// Always-editable, explicit "Save changes" — same convention as the rest of
// Momentum's forms (TaskForm, NoteEditor), not autosave-on-blur.
export default function CompanyInfoForm({ company, onSave }) {
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(company))
  const [isSaving, setIsSaving] = useState(false)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim(),
        role: form.role.trim(),
        location: form.location.trim(),
        packageInfo: form.packageInfo.trim(),
        resumeVersion: form.resumeVersion.trim(),
        applicationDate: form.applicationDate ? new Date(form.applicationDate).toISOString() : null,
      })
      toast.success('Company details saved.')
    } catch (error) {
      toast.error(error.message || 'Could not save company details.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Company name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required minLength={1} />
          <Input label="Logo URL (optional)" value={form.logoUrl} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="https://..." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Role" value={form.role} onChange={(event) => updateField('role', event.target.value)} placeholder="SDE Intern" />
          <Input label="Location" value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="Bangalore" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Package / CTC" value={form.packageInfo} onChange={(event) => updateField('packageInfo', event.target.value)} placeholder="18 LPA" />
          <Input label="Resume version used" value={form.resumeVersion} onChange={(event) => updateField('resumeVersion', event.target.value)} placeholder="Resume_v3_SDE" />
        </div>
        <Input label="Application date" type="date" value={form.applicationDate} onChange={(event) => updateField('applicationDate', event.target.value)} />
        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={isSaving || form.name.trim().length < 1}>
            {isSaving && <LoaderCircle className="animate-spin" size={16} />}
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}
