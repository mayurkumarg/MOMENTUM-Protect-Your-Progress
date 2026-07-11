import { Bug, Lightbulb, Linkedin, Mail, MessageCircleQuestion, Phone, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../components/ToastProvider'
import { Button, Card, PageHeader, Section } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

const DEVELOPER_EMAIL = '1ms24cs408@msrit.edu'
const DEVELOPER_PHONE = '+91 7019605305'
const DEVELOPER_LINKEDIN = 'https://www.linkedin.com/in/mayur-kumar-g-8b447a261/'

const FEEDBACK_TYPES = [
  { value: 'Bug report', icon: Bug },
  { value: 'Feature request', icon: Lightbulb },
  { value: 'Question', icon: MessageCircleQuestion },
  { value: 'Other', icon: Sparkles },
]

function ContactRow({ icon: Icon, title, detail, href }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="focus-ring group flex items-center gap-4 border-b border-line px-5 py-4 transition-colors last:border-0 hover:bg-surface-subtle"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-copy">{title}</p>
        <p className="mt-0.5 truncate text-xs text-faint">{detail}</p>
      </div>
    </a>
  )
}

const buildMailto = ({ type, message, name, email }) => {
  const subject = encodeURIComponent(`Momentum feedback — ${type}`)
  const bodyLines = [
    message,
    '',
    '---',
    name ? `From: ${name}` : null,
    email ? `Reply to: ${email}` : null,
  ].filter(Boolean)
  const body = encodeURIComponent(bodyLines.join('\n'))
  return `mailto:${DEVELOPER_EMAIL}?subject=${subject}&body=${body}`
}

export default function HelpFeedback() {
  const toast = useToast()
  const auth = useAuth()
  const [type, setType] = useState('Bug report')
  const [message, setMessage] = useState('')
  const [name, setName] = useState(auth.user?.username || '')
  const [email, setEmail] = useState(auth.user?.email || '')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (message.trim().length < 5) {
      toast.error('Add a little more detail before sending.')
      return
    }

    window.location.href = buildMailto({ type, message: message.trim(), name: name.trim(), email: email.trim() })
    toast.success('Opening your email app with this pre-filled — just hit send.')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Help & Feedback"
        description="Momentum is built for people actually trying to get work done — if something's broken, confusing, or missing, this is the fastest way to tell me."
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Share feedback" description="Bug, idea, or question — pick what fits and send it straight to my inbox.">
          <Card className="p-5">
            <div className="mb-5 flex flex-wrap gap-2">
              {FEEDBACK_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${type === option.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}
                >
                  <option.icon size={13} />
                  {option.value}
                </button>
              ))}
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-copy">What's on your mind?</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="The more specific, the faster I can act on it — what happened, what you expected, or what you'd like to see."
                  rows={5}
                  required
                  minLength={5}
                  className="focus-ring w-full rounded-md border border-line bg-surface px-3.5 py-3 text-sm text-copy placeholder:text-faint"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-copy">Name (optional)</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy placeholder:text-faint"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-copy">Email (optional)</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="So I can reply"
                    className="focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy placeholder:text-faint"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-faint">Sending opens your email app with this pre-filled — nothing leaves your device otherwise.</p>
                <Button type="submit" icon={Send} className="shrink-0">Send</Button>
              </div>
            </form>
          </Card>
        </Section>

        <div className="space-y-7">
          <Section title="Contact the developer">
            <Card className="overflow-hidden">
              <ContactRow icon={Mail} title="Email" detail={DEVELOPER_EMAIL} href={`mailto:${DEVELOPER_EMAIL}`} />
              <ContactRow icon={Phone} title="Phone" detail={DEVELOPER_PHONE} href={`tel:${DEVELOPER_PHONE.replace(/\s+/g, '')}`} />
              <ContactRow icon={Linkedin} title="LinkedIn" detail="Mayur Kumar G" href={DEVELOPER_LINKEDIN} />
            </Card>
          </Section>
          <Card className="p-5">
            <p className="eyebrow">Why it matters</p>
            <p className="mt-4 font-display text-lg font-bold leading-6">Every report shapes what gets built next.</p>
            <p className="mt-2 text-sm leading-5 text-muted">Momentum is actively developed — feedback here directly informs what gets fixed or added next.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
