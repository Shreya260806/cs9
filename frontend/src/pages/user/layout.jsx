import { useEffect, useState, useLayoutEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import DashboardHeader from './components/Header/DashboardHeader'
import LeftPane from './components/LeftPane/LeftPane'
import Footer from '../../components/Footer/Footer'
import NotificationSidebar from './components/NotifSidebar/NotificationSidebar'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import { queryClient } from '../../lib/queryClient'
import { fetchNotifications, markAllNotifRead, logoutUser, fetchQuestionTags } from './service'

function UserLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearUser } = useAuthStore()
  const isDark = useThemeStore(s => s.isDark)
  const toggleDark = useThemeStore(s => s.toggleDark)

  // Sync .dark class to <body> so CSS variables + dark: variants propagate globally
  useLayoutEffect(() => {
    document.body.classList[isDark ? 'add' : 'remove']('dark')
  }, [isDark])

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false)
  const [currentView, setCurrentView]     = useState('dashboard')
  const [sidebarNav, setSidebarNav]        = useState('Dashboard')
  const [notifSidebarOpen, setNotifSidebarOpen] = useState(false)
  const [selectedTags, setSelectedTags]    = useState([])
  const [searchQuery, setSearchQuery]      = useState('')
  const [tags, setTags]                   = useState([])

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const activeSidebarNav = (() => {
    if (location.pathname === '/my-contributions') return ''
    if (location.pathname === '/leaderboard') return 'Leaderboard'
    if (location.pathname === '/dashboard') return sidebarNav === 'My Queries' ? 'My Queries' : 'Dashboard'
    if (location.pathname.startsWith('/query/')) return location.state?.activeSidebarNav || ''
    return ''
  })()

  useEffect(() => {
    fetchNotifications()
      .then(data => {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount ?? 0)
      })
      .catch(() => {})

    fetchQuestionTags()
      .then(data => {
        setTags(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    try {
      await logoutUser()
    } catch {
      // Clear locally even if API call fails
    }
    clearUser()
    navigate('/')
  }

  async function handleNotifOpen() {
    if (unreadCount > 0) {
      try {
        await markAllNotifRead()
        setUnreadCount(0)
        setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
      } catch { /* silent */ }
    }
  }

  function handleNotifViewAll() {
    setNotifSidebarOpen(true)
  }

  async function handleMarkAllNotifRead() {
    try {
      await markAllNotifRead()
      setUnreadCount(0)
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    } catch { /* silent */ }
  }

  return (
    <div
      className={`flex h-svh overflow-hidden flex-col bg-bg-primary text-text-primary ${
        isDark ? 'dark' : ''
      }`}
    >
      {/* Main row: LeftPane + content */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPane
          isCollapsed={isLeftPaneCollapsed}
          onToggleCollapse={() => setIsLeftPaneCollapsed(v => !v)}
          activeNav={activeSidebarNav}
          onNavigate={label => {
            if (label === 'Leaderboard') {
              navigate('/leaderboard')
              return
            }
            setSidebarNav(label)
            setCurrentView('dashboard')
            queryClient.removeQueries({ queryKey: ['dashboardQuestions'] })
            navigate('/dashboard')
          }}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader
            user={user}
            initials={initials}
            notifications={notifications}
            unreadCount={unreadCount}
            isDark={isDark}
            onDarkToggle={toggleDark}
            searchQuery={searchQuery}
            onSearchOpen={setSearchQuery}
            tags={tags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            onNotifOpen={handleNotifOpen}
            onNotifViewAll={handleNotifViewAll}
            showSearch={location.pathname !== '/leaderboard'}
            showRaiseQuery={location.pathname !== '/raise-query'}
            onRaiseQuery={() => navigate('/raise-query')}
            onProfileSettings={() => navigate('/profile')}
            onLogout={handleLogout}
          />

          <div className="flex-1 overflow-y-auto">
            <Outlet
              context={{
              user,
              sidebarNav,
              setSidebarNav,
              currentView,
              setCurrentView,
              initials,
              searchQuery,
              selectedTags,
              setSelectedTags,
              tags,
            }}
          />
            {/* Footer — appears at the bottom of the scrolled content */}
            <div className="mt-auto">
              <Footer />
            </div>
          </div>
        </div>
      </div>

      {/* Notification sidebar */}
      <NotificationSidebar
        isOpen={notifSidebarOpen}
        onClose={() => setNotifSidebarOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotifRead}
      />
    </div>
  )
}

export default UserLayout
