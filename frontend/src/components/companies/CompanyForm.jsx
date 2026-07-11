import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button, Input } from '../ui'
import { COMPANY_STATUS_OPTIONS } from '../../utils/companies'

const emptyForm = { name: '', role: '', location: '', status: 'WISHLIST' }

// Deliberately compact — just enough to get a company on the board. Most
// companies start at Wishlist with only a name known; everything else
// (package, resume version, application date, important dates) is filled in
// afterward on the company's own detail page, where there's room for it.
export default function CompanyForm({ onSubmit, onCancel, isSaving }) {
  const [form, setForm] = useState(emptyForm)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    const created = await onSubmit({
      name: form.name.trim(),
      role: form.role.trim(),
      location: form.location.trim(),
      status: form.status,
    })
    if (created) setForm(emptyForm)
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Input label="Company name" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Acme Corp" required minLength={1} autoFocus />
      <Input label="Role (optional)" value={form.role} onChange={(event) => updateField('role', event.target.value)} placeholder="SDE Intern" />
      <Input label="Location (optional)" value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="Bangalore" />
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-copy">Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy">
          {COMPANY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || form.name.trim().length < 1}>
          {isSaving && <LoaderCircle className="animate-spin" size={16} />}
          Add company
        </Button>
      </div>
    </form>
  )
}
