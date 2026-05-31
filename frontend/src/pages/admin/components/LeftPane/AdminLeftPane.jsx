/* global __PROJECT_NAME__, __PROJECT_TAGLINE__ */
import { Zap, LayoutGrid, MessageSquare, PanelLeftClose, Settings, SlidersHorizontal, Users, Flag } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { id: 'queriesManagement', label: 'Queries', Icon: MessageSquare },
  { id: 'flagModeration', label: 'Flags', Icon: Flag },
  { id: 'userManagement', label: 'Users', Icon: Users },
  { id: 'sparkLeaderboard', label: 'Spark', Icon: Zap },
  { id: 'faqManagement', label: 'FAQ', Icon: Settings },
  { id: 'settings', label: 'Settings', Icon: SlidersHorizontal },
]

function AdminLeftPane({ currentView, onNavigate }) {
  const activeView = currentView === 'queryDetail' ? 'queriesManagement' : currentView

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-[#f8f9fa] pt-6 md:flex dark:bg-bg-tertiary">
      <button
        type="button"
        className="flex flex-col px-6 pb-6 text-left transition hover:opacity-80"
        onClick={() => onNavigate('dashboard')}
      >
        <h2 className="font-display text-[18px] font-bold leading-tight text-[#0f172a]">
          {__PROJECT_NAME__ || 'Vicharanashala'}
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          {__PROJECT_TAGLINE__ || 'Lab Internship Hub'}
        </p>
      </button>

      <div className="mb-3 px-6">
        <p className="font-display text-[13px] font-semibold leading-snug text-text-primary">
          Control room
        </p>
      </div>

      <nav className="relative flex flex-col gap-0.5 pl-6 pr-3">
        <span className="absolute bottom-2 left-5 top-2 w-px bg-bg-tertiary" aria-hidden="true" />
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activeView === id

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-10 w-full items-center gap-3 rounded-r-lg px-3 py-2 text-left text-[14px] transition ${isActive
                  ? 'border-r-2 border-brand bg-brand/10 font-semibold text-brand'
                  : 'text-text-secondary hover:bg-brand/10 hover:text-brand'
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-6 pb-5">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-2 text-[12px] text-text-muted">
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
          Admin workspace
        </div>
      </div>
    </aside>
  )
}

export default AdminLeftPane
