import { useMemo } from 'react'
import { CheckCircle2, Chrome, Copy, Download, FolderOpen, ShieldCheck, ToggleRight } from 'lucide-react'
import { Button, Card, Section } from '../components/ui'
import { useToast } from '../components/ToastProvider'

const DOWNLOAD_URL = '/downloads/momentum-sync-extension.zip'
const EXTENSIONS_URL = 'chrome://extensions'

function detectBrowser() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (ua.includes('Edg/')) return 'edge'
  if (ua.includes('Chrome/')) return 'chrome'
  if (ua.includes('Firefox/')) return 'firefox'
  if (ua.includes('Safari/')) return 'safari'
  return 'unknown'
}

const STEPS = [
  {
    icon: Download,
    title: 'Download the extension',
    text: 'Click the download button above — it saves a zip containing the unpacked Momentum extension.',
  },
  {
    icon: FolderOpen,
    title: 'Unzip it',
    text: "Extract the zip to a folder you'll keep around. Chrome loads the extension directly from this folder, so don't delete it after installing.",
  },
  {
    icon: ToggleRight,
    title: 'Open chrome://extensions and enable Developer mode',
    text: 'Copy the address below into your address bar, then switch on the "Developer mode" toggle in the top-right corner.',
    copyValue: EXTENSIONS_URL,
  },
  {
    icon: CheckCircle2,
    title: 'Click "Load unpacked" and select the folder',
    text: 'A new button appears once Developer mode is on. Select the folder you unzipped in step 2, then log into Momentum — the extension connects automatically.',
  },
]

export default function Install() {
  const browser = useMemo(detectBrowser, [])
  const supported = browser === 'chrome' || browser === 'edge'
  const toast = useToast()

  // Chrome blocks web pages from navigating to chrome:// URLs directly (a
  // browser security restriction, not something we control), so the closest
  // thing to "clickable" is a one-click copy the user pastes into their
  // address bar themselves.
  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied — paste it into your address bar.')
    } catch {
      toast.error('Could not copy automatically — select and copy the address manually.')
    }
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-lg border border-line bg-surface-subtle text-accent"><Chrome size={20} /></div>
          <h1 className="font-display text-3xl font-extrabold text-ink">Install the Momentum extension</h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted">Automatically captures solved problems from LeetCode, GeeksforGeeks, Codeforces, HackerRank, CodeChef, AtCoder, and InterviewBit.</p>
        </div>

        {!supported && (
          <Card className="border-l-4 border-l-coral p-5">
            <p className="text-sm font-semibold text-ink">Chrome or Edge required</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              {browser === 'firefox' && "Firefox isn't supported yet — it's on the roadmap."}
              {browser === 'safari' && "Safari isn't supported — Momentum's extension is built for Chromium browsers."}
              {browser === 'unknown' && 'The install steps below are written for Chrome and Edge.'}
            </p>
          </Card>
        )}

        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Button icon={Download} onClick={() => { window.location.href = DOWNLOAD_URL }}>
            Download momentum-sync-extension.zip
          </Button>
          <p className="text-xs text-faint">No account needed to install — you'll connect it after logging into Momentum.</p>
        </Card>

        <Section title="Install steps">
          <Card className="divide-y divide-line overflow-hidden">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-4 px-5 py-4">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{index + 1}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted">{step.text}</p>
                  {step.copyValue && (
                    <button
                      type="button"
                      onClick={() => handleCopy(step.copyValue)}
                      className="focus-ring mt-2 flex items-center gap-2 rounded-md border border-line bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <Copy size={13} />
                      {step.copyValue}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </Section>

        <Card className="flex items-start gap-3 p-5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted"><ShieldCheck size={17} /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Chrome will show a "Developer mode extensions" warning</p>
            <p className="mt-1 text-sm leading-5 text-muted">This is expected — Chrome shows it for any extension installed outside the Chrome Web Store, not something specific to Momentum. The extension only talks to Momentum's own backend and the coding platforms listed above; it doesn't run any remote or hidden code.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
