import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  Code2,
  Compass,
  Github,
  Info,
  Plus,
  RotateCw,
  Sparkles,
  TrendingDown,
  User,
} from 'lucide-react'
import { assistantApi } from '../api'
import { Button, PageHeader } from '../components/ui'
import Markdown from '../components/Markdown'
import { LogoMark } from '../components/Logo'

const STORAGE_KEY = 'momentum-assistant-history'
const MAX_STORED_MESSAGES = 40

// Shown in the empty state — the same coaching questions the assistant is built
// to answer from the user's real Momentum data. Each carries an icon so the
// empty state reads as a set of capabilities, not a wall of text.
const SUGGESTED_PROMPTS = [
  { text: 'What should I work on today?', icon: Compass },
  { text: "Summarize today's progress.", icon: CalendarDays },
  { text: 'What deadlines should I prioritize?', icon: CalendarClock },
  { text: 'How is my DSA progress?', icon: Code2 },
  { text: 'Show my GitHub progress.', icon: Github },
  { text: 'Am I falling behind on anything?', icon: TrendingDown },
]

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  } catch {
    return []
  }
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5" aria-label="Assistant is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 animate-bounce rounded-full bg-accent/60"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  )
}

function Avatar({ role }) {
  if (role === 'user') {
    return (
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-subtle text-muted ring-1 ring-inset ring-line">
        <User size={16} />
      </div>
    )
  }
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/15">
      <LogoMark size={16} />
    </div>
  )
}

function MessageRow({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`animate-pop-in flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar role={message.role} />
      <div
        className={`min-w-0 max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-tr-sm bg-accent text-white shadow-[var(--shadow-sm)]'
            : 'rounded-tl-sm border border-line bg-surface-subtle text-copy'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[14px] leading-6">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </div>
  )
}

export default function Assistant() {
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const [configured, setConfigured] = useState(null) // null = unknown, true/false once checked

  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  const hasConversation = messages.length > 0

  // Check once whether the backend has an LLM key; drives the "not configured" note.
  useEffect(() => {
    let active = true
    assistantApi
      .getAssistantStatus()
      .then((data) => { if (active) setConfigured(Boolean(data?.configured)) })
      .catch(() => { if (active) setConfigured(true) }) // don't block the UI if the probe fails
    return () => { active = false }
  }, [])

  // Persist recent history so the conversation survives reloads.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)))
    } catch {
      /* storage full/unavailable — non-fatal */
    }
  }, [messages])

  // Keep the latest message in view as the conversation grows / the reply streams in.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, isSending])

  // Auto-grow the composer up to a cap so multi-line prompts feel natural.
  const resizeTextarea = useCallback(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  const sendConversation = useCallback(async (conversation) => {
    setIsSending(true)
    setError(null)
    try {
      const data = await assistantApi.sendAssistantMessage(conversation)
      const reply = data?.reply?.trim()
      if (!reply) throw new Error('Empty response')
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err?.message || 'The assistant could not respond. Please try again.')
    } finally {
      setIsSending(false)
    }
  }, [])

  const handleSend = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) return

      const next = [...messages, { role: 'user', content: trimmed }]
      setMessages(next)
      setInput('')
      sendConversation(next)
    },
    [messages, isSending, sendConversation]
  )

  // Retry re-sends the current conversation (which already ends with the user's
  // message, since the failed turn added no assistant reply).
  const handleRetry = useCallback(() => {
    if (isSending || messages.length === 0) return
    sendConversation(messages)
  }, [isSending, messages, sendConversation])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setInput('')
    setError(null)
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend(input)
    }
  }

  const notConfigured = configured === false

  const composerHint = useMemo(() => {
    if (notConfigured) return 'The assistant is not available yet. Please check back later.'
    return 'Momentum AI uses your live workspace — tasks, DSA, GitHub, and analytics. Press Enter to send.'
  }, [notConfigured])

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[520px] flex-col gap-5 lg:h-[calc(100dvh-4.5rem)]">
      <PageHeader
        eyebrow="Momentum AI"
        title="Assistant"
        description="A productivity coach that already knows your tasks, deadlines, and coding activity."
        actions={hasConversation ? <Button variant="secondary" icon={Plus} onClick={handleNewChat}>New chat</Button> : null}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-md)]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {!hasConversation ? (
            <div className="animate-fade-in flex h-full flex-col items-center justify-center px-2 py-6 text-center">
              <div className="relative mb-6">
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent/70 text-white shadow-[var(--shadow-lg)]">
                  <Sparkles size={28} />
                </div>
                <span className="absolute inset-0 -z-10 rounded-2xl bg-accent/25 blur-2xl" aria-hidden="true" />
              </div>
              <h2 className="font-display text-[22px] font-bold text-ink">How can I help you make progress?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Ask about your workload, deadlines, or coding practice — I&apos;ll answer using your real Momentum data.
              </p>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map(({ text, icon: Icon }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSend(text)}
                    disabled={isSending || notConfigured}
                    className="group focus-ring lift flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                      <Icon size={16} />
                    </span>
                    <span className="text-[13px] font-medium leading-snug text-copy">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <MessageRow key={index} message={message} />
              ))}
              {isSending && (
                <div className="animate-fade-in flex gap-3">
                  <Avatar role="assistant" />
                  <div className="flex items-center rounded-2xl rounded-tl-sm border border-line bg-surface-subtle px-4 py-3.5">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {error && (
                <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-coral/25 bg-coral-soft px-4 py-3">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-coral" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-coral">Couldn&apos;t get a response</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-muted">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isSending}
                    className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border border-coral/30 px-2.5 py-1.5 text-[13px] font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
                  >
                    <RotateCw size={13} /> Retry
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface-subtle/60 p-3 sm:p-4">
          {notConfigured && (
            <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-yellow/30 bg-yellow-soft px-3 py-2 text-[13px] text-copy">
              <Info size={15} className="mt-0.5 shrink-0 text-yellow" />
              <span>The AI assistant isn&apos;t available yet. Please check back later.</span>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSend(input)
            }}
            className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-sm)] transition-colors focus-within:border-accent/50"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask about your tasks, deadlines, DSA, or anything else…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || notConfigured}
              className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-copy outline-none placeholder:text-faint disabled:opacity-60"
            />
            <Button
              type="submit"
              variant="accent"
              icon={ArrowUp}
              aria-label="Send message"
              disabled={!input.trim() || isSending || notConfigured}
              className="size-10 shrink-0 px-0"
            >
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-faint">{composerHint}</p>
        </div>
      </div>
    </div>
  )
}
