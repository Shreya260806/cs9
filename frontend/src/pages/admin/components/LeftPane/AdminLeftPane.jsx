/* global __PROJECT_NAME__, __PROJECT_TAGLINE__ */
import { Zap, LayoutGrid, MessageSquare, Menu, Settings, SlidersHorizontal, Users, Flag } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { id: 'queriesManagement', label: 'Queries', Icon: MessageSquare },
  { id: 'flagModeration', label: 'Flags', Icon: Flag },
  { id: 'userManagement', label: 'Users', Icon: Users },
  { id: 'sparkLeaderboard', label: 'Spark', Icon: Zap },
  { id: 'faqManagement', label: 'FAQ', Icon: Settings },
  { id: 'settings', label: 'Settings', Icon: SlidersHorizontal },
]

function AdminLeftPane({ currentView, onNavigate, isCollapsed, onToggleCollapse }) {
  const activeView = currentView === 'queryDetail' ? 'queriesManagement' : currentView

  return (
    <aside className={`sticky top-0 h-svh overflow-y-auto hidden shrink-0 flex-col border-r border-border bg-bg-secondary pt-6 md:flex ${isCollapsed ? 'w-20' : 'w-64'} dark:bg-bg-tertiary`}>
      <div className={`flex items-start ${isCollapsed ? 'justify-center px-2 pb-6' : 'justify-between gap-3 px-6 pb-6'}`}>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`min-w-0 text-left transition hover:opacity-80 ${isCollapsed ? 'hidden' : 'block'}`}
        >
          <h2 className="font-display text-[18px] font-bold leading-tight text-text-primary">
            {__PROJECT_NAME__ || 'Vicharanashala'}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {__PROJECT_TAGLINE__ || 'Lab Internship Hub'}
          </p>
        </button>

        <button
          type="button"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-light bg-bg-card text-text-secondary shadow-sm transition hover:border-brand hover:bg-brand/10 hover:text-brand"
        >
          <Menu className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>

      <nav className={`relative flex flex-col gap-0.5 ${isCollapsed ? 'items-center px-1' : 'pl-6 pr-3'}`}>
        {!isCollapsed && <span className="absolute bottom-2 left-5 top-2 w-px bg-bg-tertiary" aria-hidden="true" />}
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activeView === id

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-10 w-full items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-r-lg px-3 py-2 text-left text-[14px] transition ${isActive
                  ? 'border-r-2 border-brand bg-brand/10 font-semibold text-brand dark:bg-brand/10'
                  : 'text-text-secondary hover:bg-brand/10 hover:text-brand dark:hover:bg-brand/10 dark:hover:text-brand'
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!isCollapsed && <span>{label}</span>}
            </button>
          )
        })}
      </nav>

    </aside>
  )
}

export default AdminLeftPane
