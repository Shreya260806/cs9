import { LayoutGrid, MessageSquare, Trophy, PanelLeftClose, PanelLeft } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',   Icon: LayoutGrid    },
  { label: 'My Queries',  Icon: MessageSquare },
  { label: 'Leaderboard', Icon: Trophy        },
]

function LeftPane({ isCollapsed, onToggleCollapse, sidebarNav, currentView, onNavigate }) {
  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-[#c4c7c7] bg-[#f8f9fa] pt-6 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand */}
      <button
        type="button"
        className={`flex flex-col ${isCollapsed ? 'items-center px-2' : 'px-6'} pb-6 text-left`}
        onClick={() => onNavigate('Dashboard')}
      >
        <h2 className="font-display text-[18px] font-bold leading-tight text-[#0f172a]">
          Vicharanashala
        </h2>
        {!isCollapsed && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">
            Lab Internship Hub
          </p>
        )}
      </button>

      {/* Section label — hidden when collapsed */}
      {!isCollapsed && (
        <div className="mb-3 px-6">
          <p className="font-display text-[13px] font-semibold leading-snug text-[#191c1d]">
            Student portal
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className={`relative flex flex-col gap-0.5 ${isCollapsed ? 'items-center px-1' : 'pl-6 pr-3'}`}>
        <span className="absolute bottom-2 left-5 top-2 w-px bg-[#d9dadb]" aria-hidden="true" />

        {NAV_ITEMS.map(({ label, Icon }) => {
          const isActive = sidebarNav === label && currentView === 'dashboard'

          return (
            <button
              key={label}
              type="button"
              title={isCollapsed ? label : undefined}
              onClick={() => onNavigate(label)}
              className={`flex min-h-10 items-center gap-3 rounded-r-lg py-2 text-left transition ${
                isCollapsed ? 'w-10 justify-center px-0' : 'w-full px-3'
              } ${
                isActive
                  ? 'border-r-2 border-[#8c6a40] bg-[#8c6a40]/10 font-semibold text-[#8c6a40]'
                  : 'text-[#444748] hover:bg-[#8c6a40]/10 hover:text-[#8c6a40]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!isCollapsed && <span>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Toggle button — pinned to bottom */}
      <button
        type="button"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleCollapse}
        className={`absolute bottom-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#747878] transition hover:bg-[#8c6a40]/10 hover:text-[#8c6a40] ${
          isCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-3'
        }`}
      >
        {isCollapsed
          ? <PanelLeft className="h-4 w-4" strokeWidth={1.8} />
          : <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
        }
      </button>
    </aside>
  )
}

export default LeftPane
