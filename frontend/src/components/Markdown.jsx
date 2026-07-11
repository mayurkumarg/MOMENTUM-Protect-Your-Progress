import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// A small, dependency-free Markdown renderer tuned for assistant replies. It
// renders to real React elements (never dangerouslySetInnerHTML), so it's
// XSS-safe by construction. Supports the subset an LLM actually emits:
// headings, paragraphs, ordered/unordered lists, blockquotes, horizontal
// rules, fenced code blocks, and inline **bold**, *italic*, `code`, links.

const isBlockStart = (line) =>
  /^```/.test(line) ||
  /^#{1,6}\s+/.test(line) ||
  /^\s*([-*+]|\d+\.)\s+/.test(line) ||
  /^>\s?/.test(line) ||
  /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)

// ── Block-level parse ────────────────────────────────────────────────────
function parseBlocks(text) {
  const blocks = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      const code = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // consume closing fence
      blocks.push({ type: 'code', lang: fence[1] || '', content: code.join('\n') })
      continue
    }

    if (/^\s*$/.test(line)) {
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] })
      i += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', content: quote.join('\n') })
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const para = [line]
    i += 1
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'para', content: para.join('\n') })
  }

  return blocks
}

// ── Inline parse ─────────────────────────────────────────────────────────
const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)]+\))/g

const isSafeUrl = (url) => /^(https?:\/\/|mailto:)/i.test(url)

function parseInline(text, keyPrefix) {
  const parts = text.split(INLINE_PATTERN)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (!part) return null

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
          {part.slice(1, -1)}
        </code>
      )
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link && isSafeUrl(link[2])) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2 hover:opacity-80">
          {link[1]}
        </a>
      )
    }
    return <span key={key}>{part}</span>
  })
}

// Renders text that may contain hard line breaks, preserving them as <br/>.
function InlineText({ text, keyPrefix }) {
  const lines = text.split('\n')
  return lines.map((line, index) => (
    <span key={`${keyPrefix}-l${index}`}>
      {parseInline(line, `${keyPrefix}-l${index}`)}
      {index < lines.length - 1 && <br />}
    </span>
  ))
}

function CodeBlock({ lang, content }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-line bg-surface-subtle">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 text-[13px] leading-relaxed">
        <code className="font-mono text-copy">{content}</code>
      </pre>
    </div>
  )
}

const HEADING_CLASSES = {
  1: 'mt-4 mb-2 font-display text-lg font-bold text-ink',
  2: 'mt-4 mb-2 font-display text-base font-bold text-ink',
  3: 'mt-3 mb-1.5 font-display text-[15px] font-bold text-ink',
}

export default function Markdown({ content }) {
  if (!content) return null
  const blocks = parseBlocks(content)

  return (
    <div className="text-[14px] leading-6 text-copy [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'code':
            return <CodeBlock key={key} lang={block.lang} content={block.content} />
          case 'heading': {
            const Tag = `h${Math.min(block.level, 6)}`
            return (
              <Tag key={key} className={HEADING_CLASSES[Math.min(block.level, 3)] || HEADING_CLASSES[3]}>
                <InlineText text={block.content} keyPrefix={key} />
              </Tag>
            )
          }
          case 'hr':
            return <hr key={key} className="my-4 border-line" />
          case 'quote':
            return (
              <blockquote key={key} className="my-3 border-l-2 border-line-strong pl-3 text-muted">
                <InlineText text={block.content} keyPrefix={key} />
              </blockquote>
            )
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag key={key} className={`my-2 space-y-1 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-faint`}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-i${itemIndex}`} className="pl-1">
                    <InlineText text={item} keyPrefix={`${key}-i${itemIndex}`} />
                  </li>
                ))}
              </ListTag>
            )
          }
          default:
            return (
              <p key={key} className="my-2">
                <InlineText text={block.content} keyPrefix={key} />
              </p>
            )
        }
      })}
    </div>
  )
}
