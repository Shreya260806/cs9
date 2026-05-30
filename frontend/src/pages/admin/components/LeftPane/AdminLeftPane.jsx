import { Zap, LayoutGrid, MessageSquare, PanelLeftClose, Settings, User } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { id: 'queriesManagement', label: 'Queries', Icon: MessageSquare },
  { id: 'sparkLeaderboard', label: 'Spark', Icon: Zap },
  { id: 'faqManagement', label: 'FAQ', Icon: Settings },
]

function AdminLeftPane({ currentView, onNavigate }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[#d9dadb] bg-[#f8f9fa] pt-6 md:flex">
      <button
        type="button"
        className="flex flex-col px-6 pb-6 text-left"
        onClick={() => onNavigate('dashboard')}
      >
        <h2 className="font-display text-[18px] font-bold leading-tight text-[#0f172a]">
          Vicharanashala
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">
          Lab Internship Hub
        </p>
      </button>

      <div className="mb-3 px-6">
        <p className="font-display text-[13px] font-semibold leading-snug text-[#191c1d]">
          Control room
        </p>
      </div>

      <nav className="relative flex flex-col gap-0.5 pl-6 pr-3">
        <span className="absolute bottom-2 left-5 top-2 w-px bg-[#d9dadb]" aria-hidden="true" />
        {navItems.map(({ id, label, Icon }) => {
          const isActive = currentView === id

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex min-h-10 w-full items-center gap-3 rounded-r-lg px-3 py-2 text-left text-[14px] transition ${
                isActive
                  ? 'border-r-2 border-[#8c6a40] bg-[#8c6a40]/10 font-semibold text-[#8c6a40]'
                  : 'text-[#444748] hover:bg-[#8c6a40]/10 hover:text-[#8c6a40]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-6 pb-5">
        <div className="flex items-center gap-2 rounded-lg border border-[#d9dadb] bg-white px-3 py-2 text-[12px] text-[#747878]">
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
          Admin workspace
        </div>
      </div>
    </aside>
  )
}

export default AdminLeftPane
