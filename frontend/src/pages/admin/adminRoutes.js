export const ADMIN_ROUTE_PATHS = Object.freeze({
  dashboard: '/admin/dashboard',
  queriesManagement: '/admin/queries',
  flagModeration: '/admin/flags',
  userManagement: '/admin/users',
  sparkLeaderboard: '/admin/spark',
  faqManagement: '/admin/faqs',
  settings: '/admin/settings',
  adminProfile: '/admin/profile',
})

export function adminPathForView(view) {
  return ADMIN_ROUTE_PATHS[view] || ADMIN_ROUTE_PATHS.dashboard
}

export function adminPathForQuery(questionId) {
  return `${ADMIN_ROUTE_PATHS.queriesManagement}/${encodeURIComponent(questionId)}`
}

function trimTrailingSlash(pathname = '') {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/admin'
}

export function adminViewFromPath(pathname = '') {
  const path = trimTrailingSlash(pathname)

  if (path === '/admin' || path === ADMIN_ROUTE_PATHS.dashboard) return 'dashboard'
  if (path === ADMIN_ROUTE_PATHS.queriesManagement) return 'queriesManagement'
  if (adminQueryIdFromPath(path)) return 'queryDetail'
  if (path === ADMIN_ROUTE_PATHS.flagModeration) return 'flagModeration'
  if (path === ADMIN_ROUTE_PATHS.userManagement) return 'userManagement'
  if (path === ADMIN_ROUTE_PATHS.sparkLeaderboard) return 'sparkLeaderboard'
  if (path === ADMIN_ROUTE_PATHS.faqManagement) return 'faqManagement'
  if (path === ADMIN_ROUTE_PATHS.settings) return 'settings'
  if (path === ADMIN_ROUTE_PATHS.adminProfile) return 'adminProfile'

  return null
}

export function adminQueryIdFromPath(pathname = '') {
  const match = trimTrailingSlash(pathname).match(/^\/admin\/queries\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export function normalizeAdminNavigationTarget(target) {
  if (!target) return ADMIN_ROUTE_PATHS.dashboard
  if (ADMIN_ROUTE_PATHS[target]) return ADMIN_ROUTE_PATHS[target]
  if (target === 'queryDetail') return ADMIN_ROUTE_PATHS.queriesManagement

  if (target.startsWith('/query/')) {
    const questionId = target.split('/').filter(Boolean)[1]
    return questionId ? adminPathForQuery(questionId) : ADMIN_ROUTE_PATHS.queriesManagement
  }

  if (target.startsWith('/admin')) return target

  return ADMIN_ROUTE_PATHS.dashboard
}
