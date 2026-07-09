import { AlertTriangle, LoaderCircle, Plus } from 'lucide-react'

export function Button({ children, icon: Icon, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-ink text-canvas shadow-sm hover:bg-accent hover:text-white hover:shadow-md',
    secondary: 'border border-line bg-surface text-copy hover:border-line-strong hover:bg-surface-subtle',
    ghost: 'text-muted hover:bg-surface-subtle hover:text-ink',
    danger: 'bg-coral text-white shadow-sm hover:bg-coral/90 hover:shadow-md',
  }
  return (
    <button className={`focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-60 ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button aria-label={label} title={label} className={`focus-ring inline-grid size-10 place-items-center rounded-md text-muted transition-all duration-150 hover:bg-surface-subtle hover:text-ink active:scale-[0.94] ${className}`} {...props}>
      <Icon size={18} />
    </button>
  )
}

export function Card({ children, className = '' }) {
  return <section className={`surface min-w-0 rounded-lg transition-shadow duration-200 ${className}`}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-surface-subtle text-muted',
    green: 'bg-accent-soft text-accent',
    coral: 'bg-coral-soft text-coral',
    yellow: 'bg-yellow-soft text-yellow',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tones[tone]}`}>{children}</span>
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[36px]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[15px] leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  )
}

export function Section({ title, description, action, children, className = '' }) {
  return (
    <section className={`min-w-0 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex min-w-0 flex-col items-start justify-between gap-2 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ icon: Icon = Plus, title, description, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 text-center ${compact ? 'min-h-44 py-8' : 'min-h-64 py-12'}`}>
      <div className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-surface-subtle text-muted">
        <Icon size={19} />
      </div>
      <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-5 text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-surface-subtle ${className}`} />
}

export function LoadingState({ label = 'Preparing your workspace' }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-muted">
      <LoaderCircle className="mb-3 animate-spin" size={20} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({ icon: Icon = AlertTriangle, title = 'Something went wrong', description, action }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
      <div className="mb-4 grid size-11 place-items-center rounded-lg border border-coral/20 bg-coral-soft text-coral">
        <Icon size={19} />
      </div>
      <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-5 text-muted">{description || 'Momentum could not load this data.'}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Input({ label, hint, className = '', ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-copy">{label}</span>
      <input className={`focus-ring h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-copy placeholder:text-faint transition-colors hover:border-line-strong ${className}`} {...props} />
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex h-9 items-center rounded-md bg-surface-subtle p-1">
      {options.map((option) => (
        <button type="button" key={option} onClick={() => onChange(option)} className={`focus-ring h-7 rounded px-3 text-xs font-semibold transition-all duration-150 ${value === option ? 'bg-surface text-copy shadow-sm' : 'text-muted hover:text-ink'}`}>
          {option}
        </button>
      ))}
    </div>
  )
}
