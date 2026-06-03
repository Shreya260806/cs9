import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import { Bell, LogOut, Moon, Search, Settings, Sun, HelpCircle } from 'lucide-react'

function AdminHeader({
  user,
  initials,
  currentAdminView,
  searchQuery,
  unreadCount,
  isDark,
  onSearchChange,
  onSearchSubmit,
  onNotificationsOpen,
  onDarkToggle,
  onLanding,
  onLogout,
  onProfileSettings,
  onStartTour,
}) {
  return (
    <header className="sticky top-0 z-40 flex min-h-[72px] items-center justify-between border-b border-border bg-bg-secondary px-5 py-4 lg:px-8 dark:bg-bg-card">
      {currentAdminView === 'dashboard' || currentAdminView === 'queriesManagement' ? (
        <form
          data-tour="admin-search"
          className="flex h-10 w-full max-w-[420px] items-center gap-2 rounded-lg bg-bg-primary px-3 text-text-muted transition focus-within:ring-1 focus-within:ring-brand"
          onSubmit={onSearchSubmit}
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Search queries, FAQs, or status..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </form>
      ) : (
        <div />
      )}

      <div className="ml-4 flex items-center gap-4 lg:gap-6">
        <button
          data-tour="admin-faq-view"
          type="button"
          className="hidden min-h-9 items-center gap-2 rounded-lg border border-brand bg-brand px-4 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-brand-hover hover:border-brand-hover sm:inline-flex"
          onClick={onLanding}
        >
          FAQ View
        </button>

        {/* Notifications bell */}
        <div className="relative">
          <button
            data-tour="admin-notifications"
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-primary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2"
            onClick={() => onNotificationsOpen?.()}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        {/* Dark mode */}
        <button
          data-tour="admin-theme"
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-primary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2"
          onClick={() => onDarkToggle?.()}
        >
          {isDark
            ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
            : <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        </button>

        <span className="hidden h-8 w-px bg-border sm:block" />

        {/* User menu */}
        <Menu as="div" className="relative" data-tour="admin-user-menu">
          <MenuButton className="flex items-center gap-3 focus:outline-none">
            <div className="text-right leading-tight">
              <p className="text-[13px] font-medium capitalize text-text-primary">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {user?.role || 'ADMIN'}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
              {initials}
            </div>
          </MenuButton>

          <MenuItems className="absolute right-0 top-12 z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-bg-card shadow-lg focus:outline-none">
            <MenuItem>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-text-secondary transition data-focus:bg-bg-tertiary"
                onClick={onProfileSettings}
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={1.8} /> <span className="text-[13px] font-medium capitalize">Profile Settings</span>
              </button>
            </MenuItem>
            <MenuItem>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-text-secondary transition data-focus:bg-bg-tertiary"
                onClick={onStartTour}
              >
                <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> <span className="text-[13px] font-medium">Product Tour</span>
              </button>
            </MenuItem>
            <div className="h-px bg-border" />
            <MenuItem>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-red-600 transition data-focus:bg-bg-tertiary"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} /> <span className="text-[13px] font-medium">Logout</span>
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </header>
  )
}

export default AdminHeader
