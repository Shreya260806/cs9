import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import AdminHeader from './components/Header/AdminHeader'
import AdminLeftPane from './components/LeftPane/AdminLeftPane'
import AdminNotificationSidebar from './components/NotificationSidebar/AdminNotificationSidebar'
import FAQManagementView from './pages/FAQManagement'
import QueriesManagementView from './pages/QueriesManagement'
import AdminQueryDetailView from './pages/QueryDetail'
import FlagModerationView from './pages/FlagModeration'
import SparkLeaderboardView from './pages/SparkLeaderboard'
import UserManagementView from './pages/UserManagement'
import AdminProfileView from './pages/AdminProfile'
import AdminSettingsView from './pages/Settings'
import {
  ADMIN_ROUTE_PATHS,
  adminPathForQuery,
  adminViewFromPath,
  adminQueryIdFromPath,
  normalizeAdminNavigationTarget,
} from './adminRoutes'
import {
  fetchAdminDashboard,
  fetchAdminNotifications,
  logoutAdmin,
  markAllAdminNotificationsRead,
} from './service'

// Lazy-loaded so Recharts ships in a separate chunk, not the initial bundle.
const DashboardView = lazy(() => import('./pages/Dashboard'))

function AdminHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearUser } = useAuthStore()
  const isDark = useThemeStore(s => s.isDark)
  const toggleDark = useThemeStore(s => s.toggleDark)
  const resolvedAdminView = adminViewFromPath(location.pathname)
  const currentAdminView = resolvedAdminView || 'dashboard'
  const selectedQueryId = adminQueryIdFromPath(location.pathname)

  // Sync .dark on <body> so the token CSS variables also reach portaled content
  useLayoutEffect(() => {
    document.body.classList[isDark ? 'add' : 'remove']('dark')
  }, [isDark])

  const [dashboardData, setDashboardData] = useState(null)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifSidebarOpen, setNotifSidebarOpen] = useState(false)

  const initials = user?.name
    ? user.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'A'

  const loadDashboard = useCallback(async () => {
    setIsDashboardLoading(true)
    try {
      const data = await fetchAdminDashboard()
      setDashboardData(data)
    } catch {
      setDashboardData(null)
    } finally {
      setIsDashboardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/' || !resolvedAdminView) {
      navigate(ADMIN_ROUTE_PATHS.dashboard, { replace: true })
    }
  }, [location.pathname, navigate, resolvedAdminView])

  useEffect(() => {
    let isActive = true

    async function loadInitialDashboard() {
      try {
        const data = await fetchAdminDashboard()
        if (isActive) setDashboardData(data)
      } catch {
        if (isActive) setDashboardData(null)
      } finally {
        if (isActive) setIsDashboardLoading(false)
      }
    }

    loadInitialDashboard()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadNotifications() {
      try {
        const data = await fetchAdminNotifications()
        if (!isActive) return
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount ?? 0)
      } catch {
        if (!isActive) return
        setNotifications([])
        setUnreadCount(0)
      }
    }

    loadNotifications()

    return () => {
      isActive = false
    }
  }, [])

  async function handleLogout() {
    try {
      await logoutAdmin()
    } catch {
      // Local logout still wins if the network request fails.
    }
    clearUser()
    navigate('/')
  }

  const navigateAdmin = useCallback((target) => {
    const path = normalizeAdminNavigationTarget(target)
    if (path.startsWith('http')) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }
    navigate(path)
  }, [navigate])

  async function handleMarkAllNotifRead() {
    try {
      await markAllAdminNotificationsRead()
      setUnreadCount(0)
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })))
    } catch {
      // Keep the current unread state if the request fails.
    }
  }

  function handleNotifSidebarOpen() {
    setNotifSidebarOpen(true)
  }

  function handleNotifSidebarClose() {
    setNotifSidebarOpen(false)
  }

  function handleProfileSettings() {
    navigateAdmin('adminProfile')
  }

  function openQuery(questionId) {
    navigate(adminPathForQuery(questionId))
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    if (searchQuery.trim()) {
      navigateAdmin('queriesManagement')
    }
  }

  const viewProps = {
    dashboardData,
    isLoading: isDashboardLoading,
    searchQuery,
    onRefresh: loadDashboard,
    onNavigate: navigateAdmin,
  }

  return (
    <div
      className={`flex h-svh overflow-hidden bg-bg-primary text-text-primary ${
        isDark ? 'dark' : ''
      }`}
    >
      <AdminLeftPane currentView={currentAdminView} onNavigate={navigateAdmin} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          user={user}
          initials={initials}
          currentAdminView={currentAdminView}
          searchQuery={searchQuery}
          notifications={notifications}
          unreadCount={unreadCount}
          isDark={isDark}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          onNotificationsOpen={handleNotifSidebarOpen}
          onDarkToggle={toggleDark}
          onLanding={() => navigate('/')}
          onLogout={handleLogout}
          onProfileSettings={handleProfileSettings}
        />

        <div className="flex-1 overflow-y-auto">
          {currentAdminView === 'dashboard' && (
            <Suspense
              fallback={<div className="flex-1 p-8 text-[13px] text-text-muted">Loading dashboard…</div>}
            >
              <DashboardView {...viewProps} />
            </Suspense>
          )}
          {currentAdminView === 'queriesManagement' && <QueriesManagementView {...viewProps} onOpenQuery={openQuery} />}
          {currentAdminView === 'queryDetail' && (
            <AdminQueryDetailView queryId={selectedQueryId} onBack={() => navigateAdmin('queriesManagement')} />
          )}
          {currentAdminView === 'flagModeration' && <FlagModerationView {...viewProps} />}
          {currentAdminView === 'userManagement' && <UserManagementView {...viewProps} />}
          {currentAdminView === 'sparkLeaderboard' && <SparkLeaderboardView {...viewProps} />}
          {currentAdminView === 'faqManagement' && <FAQManagementView {...viewProps} />}
          {currentAdminView === 'settings' && <AdminSettingsView {...viewProps} />}
          {currentAdminView === 'adminProfile' && <AdminProfileView user={user} />}
        </div>
      </main>

      <AdminNotificationSidebar
        isOpen={notifSidebarOpen}
        onClose={handleNotifSidebarClose}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotifRead}
        onNavigate={(view) => {
          handleNotifSidebarClose()
          navigateAdmin(view)
        }}
      />
    </div>
  )
}

export default AdminHome
