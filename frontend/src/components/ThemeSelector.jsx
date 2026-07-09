import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function ThemeSelector() {
  const { preference, setTheme } = useTheme()

  return (
    <div className="inline-flex rounded-md bg-surface-subtle p-1" aria-label="Appearance">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          type="button"
          key={value}
          className={`focus-ring inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors ${preference === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          aria-pressed={preference === value}
          onClick={() => setTheme(value)}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
