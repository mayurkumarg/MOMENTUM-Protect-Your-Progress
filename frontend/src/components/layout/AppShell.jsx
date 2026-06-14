import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, BarChart3, CalendarDays, CheckSquare2, CircleHelp, Command, LayoutGrid, Menu, MessageCircle, Plus, Settings, X } from 'lucide-react'
import { Button, IconButton } from '../ui'
import ThemeToggle from '../ThemeToggle'
import { useAuth } from '../../auth/AuthProvider'

const mainNav = [
  { to: '/overview', label: 'Overview', icon: LayoutGrid },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/assistant', label: 'Assistant', icon: MessageCircle },
]

function Brand() {
  return (
    <NavLink to="/overview" className="focus-ring flex items-center gap-2 rounded-md">
      <span className="grid size-8 place-items-center rounded-md bg-ink text-canvas"><Command size={17} /></span>
      <span className="font-display text-[15px] font-extrabold text-ink">Momentum</span>
    </NavLink>
  )
}

function NavItem({ item, onClick }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} onClick={onClick} className={({ isActive }) => `focus-ring flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-subtle hover:text-ink'}`}>
      <Icon size={17} />
      {item.label}
    </NavLink>
  )
}

function Sidebar({ onNavigate }) {
  const auth = useAuth()
  const initials = auth.user?.githubId ? 'GH' : 'ME'

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="px-2"><Brand /></div>
      <nav className="mt-9 space-y-1">
        <p className="eyebrow mb-3 px-3">Workspace</p>
        {mainNav.map((item) => <NavItem item={item} key={item.to} onClick={onNavigate} />)}
      </nav>
      <div className="mt-auto space-y-1 border-t border-line pt-4">
        <NavItem item={{ to: '/settings', label: 'Settings', icon: Settings }} onClick={onNavigate} />
        <div className="flex items-center">
          <button className="focus-ring flex h-10 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-surface-subtle hover:text-ink"><CircleHelp size={17} />Help & feedback</button>
          <ThemeToggle className="size-9 shrink-0" />
        </div>
        <div className="mt-3 flex items-center gap-3 px-3 py-2">
          <div className="grid size-8 place-items-center rounded-full bg-coral-soft text-xs font-bold text-coral">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-copy">Authenticated</p>
            <p className="truncate text-[11px] text-faint">Personal workspace</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const pageName = [...mainNav, { to: '/settings', label: 'Settings' }].find((item) => item.to === location.pathname)?.label || 'Momentum'

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-200">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] border-r border-line bg-sidebar lg:block"><Sidebar /></aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
          <aside className="relative h-full w-[280px] bg-sidebar shadow-xl">
            <IconButton icon={X} label="Close menu" className="absolute right-3 top-3" onClick={() => setMenuOpen(false)} />
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <IconButton icon={Menu} label="Open menu" onClick={() => setMenuOpen(true)} />
          <span className="font-display text-sm font-bold">{pageName}</span>
        </div>
        <Button icon={Plus} className="h-9 px-3">Add task</Button>
      </header>
      <main className="pb-24 lg:ml-[232px] lg:pb-0">
        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
          <Outlet />
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-sidebar/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur lg:hidden">
        {mainNav.slice(0, 4).map((item) => {
          const Icon = item.icon
          return <NavLink key={item.to} to={item.to} className={({ isActive }) => `focus-ring flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}><Icon size={18} />{item.label}</NavLink>
        })}
        <button className="focus-ring flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-semibold text-muted" onClick={() => setMenuOpen(true)}><Menu size={18} />More</button>
      </nav>
    </div>
  )
}
