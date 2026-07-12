import { Bell, Palette, Plug, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import GithubIntegrationPanel from '../components/GithubIntegrationPanel'
import { useToast } from '../components/ToastProvider'
import { Badge, Button, Card, Input, PageHeader, SegmentedControl, Section } from '../components/ui'
import ThemeSelector from '../components/ThemeSelector'
import { useAuth } from '../auth/AuthProvider'
import { useLogout } from '../auth/hooks'
import { useExtension } from '../hooks/useExtension'
import { updateEmail, updateNotificationPreferences } from '../api/auth'

const FOCUS_STORAGE_KEY = 'momentum-current-focus'

const REMINDER_CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: 'In-app' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'BOTH', label: 'Both' },
]
const REMINDER_CHANNEL_LABELS = REMINDER_CHANNEL_OPTIONS.map((option) => option.label)
const channelToLabel = (value) => REMINDER_CHANNEL_OPTIONS.find((option) => option.value === value)?.label || 'Both'
const labelToChannel = (label) => REMINDER_CHANNEL_OPTIONS.find((option) => option.label === label)?.value || 'BOTH'

function SettingRow({ icon: Icon, title, description, children }) {
  return <div className="flex flex-col gap-4 border-b border-line px-5 py-5 last:border-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={17} /></div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-faint">{description}</p></div></div><div className="shrink-0">{children}</div></div>
}

export default function Settings() {
  const auth = useAuth()
  const extension = useExtension()
  const navigate = useNavigate()
  const toast = useToast()
  const { logout } = useLogout()
  const [focus, setFocus] = useState(() => localStorage.getItem(FOCUS_STORAGE_KEY) || '')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [isSavingChannel, setIsSavingChannel] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)

  const hasEmail = Boolean(auth.user?.email)
  const reminderChannel = auth.user?.notificationPreferences?.reminderChannel || 'BOTH'

  const startEditingEmail = () => {
    setEmailInput(auth.user?.email || '')
    setIsEditingEmail(true)
  }

  const handleEmailSave = async () => {
    const trimmed = emailInput.trim()
    if (!trimmed) {
      toast.error('Enter an email address.')
      return
    }

    setIsSavingEmail(true)
    try {
      const updatedUser = await updateEmail(trimmed)
      auth.updateUser(updatedUser)
      toast.success('Email updated.')
      setIsEditingEmail(false)
    } catch (error) {
      toast.error(error.message || 'Could not update email.')
    } finally {
      setIsSavingEmail(false)
    }
  }

  const handleChannelChange = async (label) => {
    const channel = labelToChannel(label)
    if (channel === reminderChannel) return
    if (channel !== 'IN_APP' && !hasEmail) {
      toast.error('Add an email to your account before enabling email reminders.')
      return
    }

    setIsSavingChannel(true)
    try {
      const updatedUser = await updateNotificationPreferences(channel)
      auth.updateUser(updatedUser)
      toast.success('Reminder preference updated.')
    } catch (error) {
      toast.error(error.message || 'Could not update reminder preference.')
    } finally {
      setIsSavingChannel(false)
    }
  }

  const handleFocusChange = (event) => {
    const value = event.target.value
    setFocus(value)
    if (value) localStorage.setItem(FOCUS_STORAGE_KEY, value)
    else localStorage.removeItem(FOCUS_STORAGE_KEY)
  }

  const handleInstallExtension = () => {
    if (!extension.isInstalled) {
      navigate('/install')
    } else if (!extension.isConnected) {
      toast.info('Extension installed but not connected yet — it connects automatically after you log in via the extension popup.')
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await logout()
    setSigningOut(false)
    setShowSignOutConfirm(false)
    navigate('/login')
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workspace" title="Settings" description="Shape Momentum around the way you study and work." />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-7">
          <Section title="Profile">
            <Card className="p-5">
              <div className="flex items-center gap-3.5 border-b border-line pb-5">
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-bold text-accent">
                  {(auth.user?.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-bold text-ink">{auth.user?.username || 'Your account'}</p>
                  {!isEditingEmail && (
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-muted">{auth.user?.email || 'No email on file'}</p>
                      <button type="button" className="focus-ring shrink-0 text-xs font-semibold text-accent hover:underline" onClick={startEditingEmail}>
                        {hasEmail ? 'Change' : 'Add email'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {isEditingEmail && (
                <div className="mt-5 flex flex-col gap-2.5 border-b border-line pb-5 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Input
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
                      hint="Required for email reminders."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleEmailSave} disabled={isSavingEmail}>{isSavingEmail ? 'Saving…' : 'Save'}</Button>
                    <Button variant="secondary" onClick={() => setIsEditingEmail(false)} disabled={isSavingEmail}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="mt-5">
                <Input label="Current focus" placeholder="e.g. Interview preparation" hint="Used to keep guidance relevant." value={focus} onChange={handleFocusChange} />
              </div>
              <Button className="mt-5" variant="secondary" onClick={() => setShowSignOutConfirm(true)}>Sign out</Button>
            </Card>
          </Section>
          <Section title="Preferences">
            <Card>
              <SettingRow
                icon={Bell}
                title="Reminders"
                description={hasEmail
                  ? 'Choose how you want to be notified. Set individual reminders from Tasks or Placements.'
                  : 'Set individual reminders from Tasks or Placements. Add an email to your account to enable email reminders.'}
              >
                <div className="flex flex-col items-end gap-1.5">
                  <SegmentedControl options={REMINDER_CHANNEL_LABELS} value={channelToLabel(reminderChannel)} onChange={handleChannelChange} />
                  {isSavingChannel && <span className="text-[11px] text-faint">Saving…</span>}
                </div>
              </SettingRow>
              <SettingRow icon={Palette} title="Appearance" description="Choose a comfortable workspace theme or follow your system."><ThemeSelector /></SettingRow>
            </Card>
          </Section>
          <Section title="Connections">
            <Card>
              <SettingRow icon={Plug} title="Browser extension" description="Capture DSA practice from supported platforms.">
                {extension.isConnected ? (
                  <Badge tone="green">Connected</Badge>
                ) : extension.isInstalled ? (
                  <Button variant="secondary" onClick={handleInstallExtension}>Connect</Button>
                ) : (
                  <Button variant="secondary" onClick={handleInstallExtension}>Install</Button>
                )}
              </SettingRow>
            </Card>
          </Section>
          <Section title="Coding Journal" description="Connect a repository so Momentum can track your DSA journal on GitHub.">
            <GithubIntegrationPanel />
          </Section>
        </div>
        <Card className="h-fit p-5">
          <div className="mb-4 grid size-9 place-items-center rounded-md bg-coral-soft text-coral"><UserRound size={17} /></div>
          <p className="font-display text-[15px] font-bold">Personal workspace</p>
          <p className="mt-2 text-sm leading-5 text-muted">Your plans and work record belong to you. Connection controls will stay explicit and reversible.</p>
        </Card>
      </div>
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to log in again to access your workspace."
        confirmLabel="Sign out"
        tone="danger"
        isLoading={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  )
}
