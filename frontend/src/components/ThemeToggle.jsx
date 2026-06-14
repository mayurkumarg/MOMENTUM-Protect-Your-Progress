import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { IconButton } from './ui'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return <IconButton icon={isDark ? Sun : Moon} label={`Switch to ${isDark ? 'light' : 'dark'} mode`} aria-pressed={isDark} className={className} onClick={toggleTheme} />
}
