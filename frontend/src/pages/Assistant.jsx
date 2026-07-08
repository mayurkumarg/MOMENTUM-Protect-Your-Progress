import { ArrowUp, Compass, MessageCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, PageHeader } from '../components/ui'

const prompts = ['Help me choose today’s focus', 'Turn a large task into next steps', 'Review my upcoming workload']

export default function Assistant() {
  const [message, setMessage] = useState('')
  const [showComingSoon, setShowComingSoon] = useState(false)

  const handlePromptClick = () => {
    setShowComingSoon(true)
    setTimeout(() => setShowComingSoon(false), 3000)
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setShowComingSoon(true)
    setTimeout(() => setShowComingSoon(false), 3000)
  }

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Get unstuck" title="Assistant" description="Guidance grounded in your plan and your real work, when you need a clearer next step." />
      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden">
          <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-5 grid size-12 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={20} /></div>
            <h2 className="font-display text-xl font-bold">What would make work feel clearer?</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">The assistant will help you reason about your workload without taking control away from you.</p>
            <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
              {prompts.map((prompt) => <Button key={prompt} variant="secondary" icon={prompt.includes('choose') ? Compass : MessageCircle} onClick={handlePromptClick}>{prompt}</Button>)}
            </div>
            {showComingSoon && <p className="mt-4 text-xs font-semibold text-coral">Coming soon: AI Assistant will be available after configuration</p>}
          </div>
          <div className="border-t border-line bg-surface-subtle p-3 sm:p-4">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2 rounded-lg border border-line bg-surface p-2">
              <textarea rows="2" placeholder="Ask about your workload..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleTextareaKeyDown} className="min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-copy outline-none placeholder:text-faint" />
              <Button type="submit" icon={ArrowUp} aria-label="Send message" className="size-10 px-0"><span className="sr-only">Send</span></Button>
            </form>
            <p className="mt-2 text-center text-[11px] text-faint">Assistant guidance will be available after AI integration is configured.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
