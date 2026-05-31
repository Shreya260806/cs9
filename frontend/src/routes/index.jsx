import Landing from '../pages/landing'
import AdminHome from '../pages/admin'
import UserLayout from '../pages/user/layout'
import DashboardPage from '../pages/user/pages/Dashboard'
import RaiseQueryPage from '../pages/user/pages/RaiseQuery'
import QueryDetailPage from '../pages/user/pages/QueryDetail'
import ProfileSettingsPage from '../pages/user/pages/ProfileSettings'
import MyContributionsPage from '../pages/user/pages/MyContributions'
import LeaderboardPage from '../pages/user/pages/Leaderboard'
import ProtectedRoute from './ProtectedRoute'

export const routes = [
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/admin/*',
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <AdminHome />
      </ProtectedRoute>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <UserLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfileSettingsPage /> },
      { path: '/raise-query', element: <RaiseQueryPage /> },
      { path: '/query/:queryId', element: <QueryDetailPage /> },
      { path: '/my-contributions', element: <MyContributionsPage /> },
      { path: '/leaderboard', element: <LeaderboardPage /> },
    ],
  },
]
