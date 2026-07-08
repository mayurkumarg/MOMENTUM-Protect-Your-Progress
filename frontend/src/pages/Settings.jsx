import { Bell, Github, Palette, Plug, UserRound } from 'lucide-react'
import { Button, Card, Input, PageHeader, Section } from '../components/ui'
import ThemeSelector from '../components/ThemeSelector'
import { getGithubLoginUrl } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { useExtension } from '../hooks/useExtension'

function SettingRow({ icon: Icon, title, description, children }) {
  return <div className="flex flex-col gap-4 border-b border-line px-5 py-5 last:border-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><Icon size={17} /></div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-faint">{description}</p></div></div><div className="shrink-0">{children}</div></div>
}

export default function Settings() {
  const auth = useAuth()
  const extension = useExtension()

  const handleConfigureReminders = () => {
    alert('Reminders configuration is coming soon. This feature will allow you to set up gentle prompts for planned work and reviews.')
  }

  const handleInstallExtension = () => {
    if (!extension.isInstalled) {
      // Direct them to Chrome Web Store when published
      alert('Extension is not installed. Please install from the Chrome Web Store (coming soon).')
    } else if (!extension.isConnected) {
      alert('Extension is installed but not connected. The extension should connect automatically when you log into Momentum.')
    }
  }

  const handleGithubConnect = () => {
    window.location.href = getGithubLoginUrl()
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workspace" title="Settings" description="Shape Momentum around the way you study and work." />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-7">
          <Section title="Profile">
            <Card className="p-5"><div className="grid gap-5 sm:grid-cols-2"><Input label="Session" value={auth.isAuthenticated ? 'Authenticated' : 'Signed out'} readOnly /><Input label="Current focus" placeholder="e.g. Interview preparation" hint="Used to keep guidance relevant." /></div><Button className="mt-5" variant="secondary" onClick={() => auth.signOut()}>Sign out</Button></Card>
          </Section>
          <Section title="Preferences">
            <Card>
              <SettingRow icon={Bell} title="Reminders" description="Gentle prompts for planned work and reviews."><Button variant="secondary" onClick={handleConfigureReminders}>Configure</Button></SettingRow>
              <SettingRow icon={Palette} title="Appearance" description="Choose a comfortable workspace theme or follow your system."><ThemeSelector /></SettingRow>
            </Card>
          </Section>
          <Section title="Connections">
            <Card>
              <SettingRow icon={Github} title="GitHub" description="Capture meaningful repository activity."><Button variant="secondary" onClick={handleGithubConnect}>Connect</Button></SettingRow>
              <SettingRow icon={Plug} title="Browser extension" description="Capture DSA practice from supported platforms.">
                {extension.isConnected ? (
                  <Button variant="ghost" className="pointer-events-none text-green-600 font-semibold" disabled>Connected</Button>
                ) : extension.isInstalled ? (
                  <Button variant="secondary" onClick={handleInstallExtension}>Connect</Button>
                ) : (
                  <Button variant="secondary" onClick={handleInstallExtension}>Install</Button>
                )}
              </SettingRow>
            </Card>
          </Section>
        </div>
        <Card className="h-fit p-5">
          <div className="mb-4 grid size-9 place-items-center rounded-md bg-coral-soft text-coral"><UserRound size={17} /></div>
          <p className="font-display text-[15px] font-bold">Personal workspace</p>
          <p className="mt-2 text-sm leading-5 text-muted">Your plans and work record belong to you. Connection controls will stay explicit and reversible.</p>
        </Card>
      </div>
    </div>
  )
}
