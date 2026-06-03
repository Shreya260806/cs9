import { useState } from 'react'
import {
  Popover, PopoverButton, PopoverPanel,
  Menu, MenuButton, MenuItems, MenuItem,
} from '@headlessui/react'
import { Settings, Search, SlidersHorizontal, PlusCircle, Bell, LogOut, Moon, Sun, Tag, HelpCircle } from 'lucide-react'
import { timeAgo } from '../../service'
import Button from '../../../../components/Button/Button'

// Tag → icon/color map (matches SearchModal styleForTag)
function styleForTag(tag) {
  const map = {
    'DSA':           { color: '#8c6a40', bg: '#f5f0e8' },
    'Web Dev':       { color: '#3b82f6', bg: '#eff6ff' },
    'CP':            { color: '#f59e0b', bg: '#fffbeb' },
    'AI/ML':         { color: '#8b5cf6', bg: '#f5f3ff' },
    'Systems':       { color: '#64748b', bg: '#f8fafc' },
    'OS':            { color: '#16a34a', bg: '#f0fdf4' },
    'DBMS':          { color: '#0d9488', bg: '#f0fdfa' },
    'OOP':           { color: '#9333ea', bg: '#faf5ff' },
    'Aptitude':      { color: '#dc2626', bg: '#fef2f2' },
    'Interview Exp': { color: '#ca8a04', bg: '#fefce8' },
  }
  return map[tag] || { color: '#8c6a40', bg: '#f5f0e8' }
}

function DashboardHeader({
  user,
  initials,
  showRaiseQuery = true,
  showSearch = true,
  notifications,
  unreadCount,
  isDark,
  onSearchOpen,
  onRaiseQuery,
  onNotifOpen,
  onNotifViewAll,
  onDarkToggle,
  onProfileSettings,
  onLogout,
  onStartTour,
  tags = [],
  selectedTags = [],
  onTagsChange,
}) {
  const [localTags, setLocalTags] = useState(selectedTags)

  function toggleTag(tag) {
    const next = localTags.includes(tag)
      ? localTags.filter(t => t !== tag)
      : [...localTags, tag]
    setLocalTags(next)
    onTagsChange?.(next)
  }

  function clearAll() {
    setLocalTags([])
    onTagsChange?.([])
  }

  const activeCount = localTags.length

  return (
    <header className="sticky top-0 z-40 flex flex-col gap-3 border-b border-border bg-[#f8f9fa] px-8 py-4 dark:bg-bg-card md:flex-row md:items-center md:justify-between">

      <div className="min-w-0 flex-1">
        {showSearch && (
          <div data-tour="search-bar" className="relative flex min-w-0 w-full max-w-[420px] items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 transition hover:bg-bg-tertiary">
            <Search className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.8} />

            <input
              type="text"
              placeholder="Search FAQs, categories, or status…"
              className="flex-1 min-w-0 bg-transparent text-[12px] text-text-primary placeholder-[#747878] outline-none"
              onChange={e => onSearchOpen?.(e.target.value)}
              onFocus={() => onSearchOpen?.('')}
            />

            <span className="h-4 w-px bg-border" />

            {/* Filter — tag popover */}
            <Popover className="relative">
              <PopoverButton className="relative flex shrink-0 items-center gap-1 text-text-muted transition hover:text-text-primary">
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
                {activeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </PopoverButton>

              <div className="absolute right-0 top-full z-50 w-[240px]">
                <PopoverPanel className="mt-2 overflow-hidden rounded-xl border border-border-light bg-bg-card/60 shadow-xl backdrop-blur-sm focus:outline-none">
                  {/* Header row */}
                  <div className="flex items-center justify-between border-b border-border-light px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        Categories
                      </span>
                      {activeCount > 0 && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand/12 text-[9px] font-semibold text-brand">
                          {activeCount}
                        </span>
                      )}
                    </div>
                    {activeCount > 0 && (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[10px] font-medium text-brand underline-offset-2 transition hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Tag list */}
                  <div className="flex flex-wrap gap-1.5 p-2.5">
                    {tags.length === 0 ? (
                      <p className="py-2 text-[11px] text-text-muted">No categories yet.</p>
                    ) : (
                      tags.map(({ tag, count }) => {
                        const { color, bg } = styleForTag(tag)
                        const isSelected = localTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-left font-medium transition hover:-translate-y-0.5 hover:shadow-sm ${
                              isSelected
                                ? 'border-brand bg-brand/5 text-brand'
                                : 'border-border-light text-text-secondary hover:border-brand hover:text-brand'
                            }`}
                          >
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded"
                              style={{ background: bg }}
                            >
                              <Tag className="h-2.5 w-2.5" strokeWidth={2} style={{ color }} />
                            </span>
                            <span className="!text-[10px] leading-none">{tag}</span>
                            {count != null && (
                              <span className={`!text-[8px] leading-none ${isSelected ? 'text-brand/70' : 'text-text-muted'}`}>
                                {count}
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </PopoverPanel>
              </div>
            </Popover>
          </div>
        )}
      </div>

      {/* Right-side action group */}
      <div className="flex flex-wrap items-center gap-3">
        {showRaiseQuery && (
          <Button
            data-tour="raise-query-btn"
            variant="secondary"
            className="min-h-7 gap-1 rounded-lg border-transparent bg-brand/80 px-2.5 py-1 font-bold uppercase tracking-wide text-white hover:border-transparent hover:bg-brand-hover"
            onClick={onRaiseQuery}
          >
            <PlusCircle className="h-3 w-3" strokeWidth={1.8} />
            <span className="text-[10px] leading-none">Raise New Query</span>
          </Button>
        )}

        {/* Bell */}
        <Popover className="relative">
          <PopoverButton
            onClick={() => onNotifOpen?.()}
            className="relative p-1 text-text-secondary transition hover:text-text-primary focus:outline-none"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </PopoverButton>

          <PopoverPanel className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-border bg-bg-card shadow-lg focus:outline-none">
            <p className="border-b border-border px-4 py-3 text-[13px] font-semibold text-text-primary">
              Notifications
            </p>
            {notifications.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12px] text-text-muted">No notifications yet</p>
            ) : (
              notifications.slice(0, 3).map(n => (
                <div
                  key={n.notification_id || n.id}
                  className={`border-b border-border-light px-4 py-3 ${n.is_read ? 'bg-bg-card' : 'bg-info/10'}`}
                >
                  <p className="mb-1 text-[12px] leading-snug text-text-secondary">{n.body || n.title}</p>
                  <span className="text-[10px] font-medium text-text-muted">
                    {n.created_at ? timeAgo(n.created_at) : ''}
                  </span>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={onNotifViewAll}
              className="w-full cursor-pointer bg-bg-tertiary py-2.5 text-center text-[11px] font-semibold text-brand transition hover:bg-bg-tertiary"
            >
              View All
            </button>
          </PopoverPanel>
        </Popover>

        {/* Dark mode toggle */}
        <button
          type="button"
          className="p-1 text-text-secondary transition hover:text-text-primary"
          onClick={() => onDarkToggle()}
        >
          {isDark
            ? <Sun  className="h-[18px] w-[18px]" strokeWidth={1.8} />
            : <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        </button>

        {/* Divider */}
        <span className="h-8 w-px bg-border" />

        {/* User menu */}
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center gap-3 focus:outline-none">
            <div className="text-right leading-tight">
              <p className="text-[13px] font-medium capitalize text-text-primary">{user?.name || 'Student'}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{user?.role || 'USER'}</p>
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

export default DashboardHeader
